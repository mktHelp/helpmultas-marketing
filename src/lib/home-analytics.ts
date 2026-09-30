import { shiftDate, type DateRange } from "@/lib/period";
import { toDateKey } from "@/lib/utils";
import type { TaskWithRelations } from "@/types/database";

// Análises da dashboard principal (tarefas do Marketing). Funções puras sobre
// SlimTask: o servidor já converte as datas pra "YYYY-MM-DD" no fuso de São
// Paulo (createdDay etc.), então aqui só se comparam strings.

export interface SlimTask {
  id: string;
  title: string;
  status: string;
  priority: "baixa" | "media" | "alta" | "urgente";
  areaId: string | null;
  contentType: string | null;
  createdDay: string;
  completedDay: string | null;
  dueDay: string | null;
  dueAt: string | null;
  publishDay: string | null;
  updatedAt: number;
  assigneeIds: string[];
}

export interface StatusFlags {
  done: Set<string>;
  cancelled: Set<string>;
}

const inRange = (day: string | null, r: DateRange) => !!day && day >= r.from && day <= r.to;

export function isOpen(t: SlimTask, f: StatusFlags) {
  return !f.done.has(t.status) && !f.cancelled.has(t.status) && !t.completedDay;
}

export function isOverdueNow(t: SlimTask, f: StatusFlags, now = Date.now()) {
  return isOpen(t, f) && !!t.dueAt && Date.parse(t.dueAt) < now;
}

export const createdIn = (tasks: SlimTask[], r: DateRange) => tasks.filter((t) => inRange(t.createdDay, r));
export const completedIn = (tasks: SlimTask[], r: DateRange) => tasks.filter((t) => inRange(t.completedDay, r));

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}

// % das concluídas (com prazo) entregues até o dia do prazo.
export function onTimeRate(done: SlimTask[]) {
  const withDue = done.filter((t) => t.dueDay && t.completedDay);
  if (!withDue.length) return null;
  const onTime = withDue.filter((t) => (t.completedDay as string) <= (t.dueDay as string)).length;
  return (onTime / withDue.length) * 100;
}

// Dias médios entre criar e concluir.
export function leadTimeDays(done: SlimTask[]) {
  const vals = done.filter((t) => t.completedDay).map((t) => Math.max(daysBetween(t.createdDay, t.completedDay as string), 0));
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
}

export interface DayPoint {
  date: string;
  created: number;
  completed: number;
  backlog: number;
}

// Criadas, concluídas e backlog aberto ao fim de cada dia do período.
// Cancelamentos não têm data própria: entram como encerrados na última
// atualização da tarefa.
export function dailyFlow(tasks: SlimTask[], range: DateRange, f: StatusFlags): DayPoint[] {
  const created = new Map<string, number>();
  const completed = new Map<string, number>();
  for (const t of tasks) {
    created.set(t.createdDay, (created.get(t.createdDay) ?? 0) + 1);
    if (t.completedDay) completed.set(t.completedDay, (completed.get(t.completedDay) ?? 0) + 1);
  }
  const closeDay = (t: SlimTask) =>
    t.completedDay ?? (f.cancelled.has(t.status) || f.done.has(t.status) ? new Date(t.updatedAt - 3 * 3600 * 1000).toISOString().slice(0, 10) : null);

  const out: DayPoint[] = [];
  for (let d = range.from; d <= range.to; d = shiftDate(d, 1)) {
    const backlog = tasks.filter((t) => t.createdDay <= d && (!closeDay(t) || (closeDay(t) as string) > d)).length;
    out.push({ date: d, created: created.get(d) ?? 0, completed: completed.get(d) ?? 0, backlog });
  }
  return out;
}

export const PRIORITY_LABEL: Record<SlimTask["priority"], string> = { urgente: "Urgente", alta: "Alta", media: "Média", baixa: "Baixa" };
export const PRIORITY_COLOR: Record<SlimTask["priority"], string> = { urgente: "#c23b3b", alta: "#e07b39", media: "#fcbf00", baixa: "#9aa7af" };

export function weekdayOf(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export interface Snapshot {
  open: number;
  overdue: number;
  dueToday: number;
  dueWeek: number;
  inProduction: number;
  unassigned: number;
  stuck: number;
  awaitingApproval: number;
}

// Retrato de agora (não depende do período).
export function snapshotNow(tasks: SlimTask[], f: StatusFlags, today: string): Snapshot {
  const now = Date.now();
  const open = tasks.filter((t) => isOpen(t, f));
  const weekEnd = shiftDate(today, 7);
  return {
    open: open.length,
    overdue: open.filter((t) => isOverdueNow(t, f, now)).length,
    dueToday: open.filter((t) => t.dueDay === today).length,
    dueWeek: open.filter((t) => t.dueDay && t.dueDay >= today && t.dueDay <= weekEnd).length,
    inProduction: open.filter((t) => t.status === "em_producao").length,
    unassigned: open.filter((t) => t.assigneeIds.length === 0).length,
    stuck: open.filter((t) => now - t.updatedAt >= 5 * 86400000).length,
    awaitingApproval: open.filter((t) => t.status === "em_revisao" || t.status === "aprovado").length,
  };
}

export interface PersonRow {
  id: string;
  completed: number;
  open: number;
  overdue: number;
  onTime: number | null;
  leadTime: number | null;
}

export function teamPerformance(tasks: SlimTask[], range: DateRange, f: StatusFlags, peopleIds: string[]): PersonRow[] {
  const now = Date.now();
  return peopleIds
    .map((id) => {
      const own = tasks.filter((t) => t.assigneeIds.includes(id));
      const done = completedIn(own, range);
      const open = own.filter((t) => isOpen(t, f));
      return {
        id,
        completed: done.length,
        open: open.length,
        overdue: open.filter((t) => isOverdueNow(t, f, now)).length,
        onTime: onTimeRate(done),
        leadTime: leadTimeDays(done),
      };
    })
    .filter((r) => r.completed > 0 || r.open > 0)
    .sort((a, b) => b.completed - a.completed || b.open - a.open);
}

export interface HomeHighlight {
  key: string;
  title: string;
  text: string;
  tone: "good" | "warn" | "info";
}

export function buildHomeHighlights(input: {
  snapshot: Snapshot;
  completed: number;
  prevCompleted: number | null;
  onTime: number | null;
  prevOnTime: number | null;
  bestWeekday: { label: string; avg: number } | null;
  worstArea: { name: string; overdue: number } | null;
  topPerson: { name: string; completed: number } | null;
  label: string;
}): HomeHighlight[] {
  const { snapshot: s, completed, prevCompleted, onTime, prevOnTime, bestWeekday, worstArea, topPerson, label } = input;
  const out: HomeHighlight[] = [];

  if (s.overdue > 0) {
    out.push({
      key: "overdue",
      title: `${s.overdue} tarefa${s.overdue > 1 ? "s" : ""} em atraso`,
      text: worstArea ? `${worstArea.name} concentra ${worstArea.overdue} delas. Priorize o destravamento hoje.` : "Priorize o destravamento hoje.",
      tone: "warn",
    });
  } else {
    out.push({ key: "overdue", title: "Nada em atraso", text: "Todas as tarefas abertas estão dentro do prazo. Bom trabalho!", tone: "good" });
  }

  if (prevCompleted != null && prevCompleted > 0) {
    const change = ((completed - prevCompleted) / prevCompleted) * 100;
    if (Math.abs(change) >= 5) {
      out.push({
        key: "throughput",
        title: `Entregas ${change > 0 ? "subiram" : "caíram"} ${Math.abs(change).toFixed(0)}%`,
        text: `${completed} concluídas em ${label.toLowerCase()} contra ${prevCompleted} no período anterior.`,
        tone: change > 0 ? "good" : "warn",
      });
    }
  }

  if (onTime != null) {
    const trend = prevOnTime != null ? (onTime >= prevOnTime ? ` (antes ${prevOnTime.toFixed(0)}%)` : ` (caiu de ${prevOnTime.toFixed(0)}%)`) : "";
    out.push({
      key: "ontime",
      title: `${onTime.toFixed(0)}% entregues no prazo`,
      text: `Das tarefas concluídas com prazo no período${trend}.`,
      tone: onTime >= 80 ? "good" : onTime >= 60 ? "info" : "warn",
    });
  }

  if (s.dueToday > 0 || s.dueWeek > 0) {
    out.push({
      key: "agenda",
      title: `${s.dueToday} para hoje · ${s.dueWeek} nos próximos 7 dias`,
      text: s.dueToday > 0 ? "Comece pelas de hoje e confira se há bloqueios." : "Nada vence hoje — boa hora de adiantar as da semana.",
      tone: "info",
    });
  }

  if (s.unassigned > 0) {
    out.push({ key: "unassigned", title: `${s.unassigned} sem responsável`, text: "Tarefas abertas sem ninguém atribuído — distribua para não ficarem paradas.", tone: "warn" });
  }
  if (s.stuck > 0) {
    out.push({ key: "stuck", title: `${s.stuck} parada${s.stuck > 1 ? "s" : ""} há mais de 5 dias`, text: "Sem atualização recente: vale cobrar ou replanejar.", tone: "warn" });
  }
  if (bestWeekday && bestWeekday.avg > 0) {
    out.push({ key: "weekday", title: `${bestWeekday.label} é o dia mais produtivo`, text: `Média de ${bestWeekday.avg.toFixed(1).replace(".", ",")} entregas nesse dia da semana.`, tone: "info" });
  }
  if (topPerson && topPerson.completed > 0) {
    out.push({ key: "top", title: `${topPerson.name} lidera as entregas`, text: `${topPerson.completed} tarefas concluídas no período.`, tone: "good" });
  }
  return out;
}

// Converte a tarefa completa pro formato leve usado nas análises (datas já no
// dia de São Paulo).
export function toSlimTask(t: TaskWithRelations): SlimTask {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    areaId: t.area_id,
    contentType: t.content_type,
    createdDay: toDateKey(t.created_at),
    completedDay: t.completed_at ? toDateKey(t.completed_at) : null,
    dueDay: t.due_date ? toDateKey(t.due_date) : null,
    dueAt: t.due_date,
    publishDay: t.publish_at ? toDateKey(t.publish_at) : null,
    updatedAt: Date.parse(t.updated_at),
    assigneeIds: (t.assignees || []).map((a) => a.id),
  };
}
