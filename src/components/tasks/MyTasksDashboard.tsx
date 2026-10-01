"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle, CalendarClock, CalendarDays, Check, CheckCircle2, CheckSquare, ChevronDown, Flame, Hourglass, ListTodo,
  Search, Target, X,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PriorityBadge, StatusBadge } from "@/components/shared/StatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { TaskTable } from "@/components/tasks/TaskTable";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import {
  BRAND, BarList, Chip, ChartTooltip, Donut, GRID_COLOR, Kpi, Panel, RTooltip, TICK_STYLE, fmt, shortDate, tipDate,
} from "@/components/shared/dash-parts";
import { createClient } from "@/lib/supabase/client";
import { updateTask } from "@/lib/services/tasks";
import { useTaskStatuses } from "@/lib/task-status-context";
import { shiftDate, todayBRT } from "@/lib/period";
import {
  PRIORITY_COLOR, PRIORITY_LABEL, completedIn, isOpen, leadTimeDays, onTimeRate, type SlimTask, type StatusFlags,
} from "@/lib/home-analytics";
import { cn, toDateKey } from "@/lib/utils";
import type { Profile, TaskWithRelations } from "@/types/database";

// "Minhas Tarefas": visão pessoal no mesmo padrão das dashboards (KPIs com
// comparação, gráficos, filtros rápidos), com três visões da mesma lista —
// por prazo (padrão), tabela (ações em lote) e quadro por status.

type Quick = "open" | "overdue" | "today" | "week" | "done" | "all";
type View = "deadline" | "table" | "board";
type Sort = "due" | "priority" | "recent";

const PRIORITY_RANK = { urgente: 0, alta: 1, media: 2, baixa: 3 } as const;

function toSlim(t: TaskWithRelations): SlimTask {
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

function dayDiff(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}

// "Hoje", "Amanhã", "há 3 dias", "em 5 dias", "dd/mm".
function dueLabel(dueDay: string | null, today: string) {
  if (!dueDay) return "Sem prazo";
  const d = dayDiff(today, dueDay);
  if (d === 0) return "Hoje";
  if (d === 1) return "Amanhã";
  if (d === -1) return "Ontem";
  if (d < 0) return `há ${-d} dias`;
  if (d <= 7) return `em ${d} dias`;
  return shortDate(dueDay);
}

interface Row {
  task: TaskWithRelations;
  slim: SlimTask;
  open: boolean;
  overdue: boolean;
}

const BUCKETS = [
  { key: "overdue", label: "Atrasadas", tone: "danger" as const },
  { key: "today", label: "Hoje", tone: "accent" as const },
  { key: "tomorrow", label: "Amanhã", tone: "neutral" as const },
  { key: "week", label: "Próximos 7 dias", tone: "neutral" as const },
  { key: "later", label: "Mais adiante", tone: "neutral" as const },
  { key: "noDue", label: "Sem prazo", tone: "neutral" as const },
  { key: "done", label: "Concluídas", tone: "success" as const },
];

function TaskRow({ row, today, onToggle, busy, compact }: { row: Row; today: string; onToggle: (r: Row) => void; busy: boolean; compact?: boolean }) {
  const { task, slim, open, overdue } = row;
  const checklist = task.checklists || [];
  const doneItems = checklist.filter((c) => c.completed).length;
  const label = open ? dueLabel(slim.dueDay, today) : slim.completedDay ? `Concluída ${shortDate(slim.completedDay)}` : "Concluída";

  return (
    <div className={cn("group flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 transition-colors hover:border-gray-300 hover:bg-gray-050/60", overdue ? "border-[color:var(--color-danger)]/30" : "border-gray-100")}>
      <button
        onClick={() => onToggle(row)}
        disabled={busy}
        title={open ? "Marcar como concluída" : "Reabrir tarefa"}
        aria-label={open ? "Marcar como concluída" : "Reabrir tarefa"}
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          open ? "border-gray-300 text-transparent hover:border-[color:var(--color-success)] hover:text-[color:var(--color-success)]" : "border-[color:var(--color-success)] bg-[color:var(--color-success)] text-white",
          busy && "opacity-50"
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </button>
      <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: PRIORITY_COLOR[task.priority] }} title={`Prioridade ${PRIORITY_LABEL[task.priority]}`} />

      <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-semibold", open ? "text-blue-900" : "text-gray-400 line-through")}>{task.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
          {task.area?.name && (
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: task.area.color }} />
              {task.area.name}
            </span>
          )}
          {task.project?.name && <span className="truncate">{task.project.name}</span>}
          {checklist.length > 0 && (
            <span className="flex items-center gap-1" title="Checklist">
              <CheckSquare className="h-3 w-3" />
              {doneItems}/{checklist.length}
            </span>
          )}
          {task.content_type && <span className="capitalize">{task.content_type}</span>}
        </div>
      </Link>

      <span
        className={cn(
          "shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
          compact ? "flex" : "hidden sm:flex",
          !open ? "bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]" : overdue ? "bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]" : slim.dueDay === today ? "bg-yellow-100 text-blue-900" : "bg-gray-100 text-gray-600"
        )}
      >
        {overdue ? <AlertTriangle className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}
        {label}
      </span>
      {!compact && <div className="hidden shrink-0 md:block"><StatusBadge status={task.status} /></div>}
      {!compact && <div className="hidden shrink-0 lg:block"><PriorityBadge priority={task.priority} /></div>}
      <div className="flex shrink-0 items-center -space-x-1.5">
        {(task.assignees || []).slice(0, 3).map((a) => (
          <UserAvatar key={a.id} name={a.full_name} avatarUrl={a.avatar_url} size="xs" className="ring-2 ring-white" />
        ))}
        {(task.assignees || []).length > 3 && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-700 ring-2 ring-white">+{(task.assignees || []).length - 3}</span>
        )}
      </div>
    </div>
  );
}

export function MyTasksDashboard({
  tasks, profiles, tab, onTabChange, onRefresh, canDelete,
}: {
  tasks: TaskWithRelations[];
  profiles: Profile[];
  tab: string;
  onTabChange: (t: string) => void;
  onRefresh: () => void;
  canDelete: boolean;
}) {
  const supabase = createClient();
  const { statuses, activeStatuses, defaultStatusKey } = useTaskStatuses();
  const today = useMemo(() => todayBRT(), []);

  const [quick, setQuick] = useState<Quick>("open");
  const [view, setView] = useState<View>("deadline");
  const [sort, setSort] = useState<Sort>("due");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const flags = useMemo<StatusFlags>(
    () => ({
      done: new Set(statuses.filter((s) => s.is_done).map((s) => s.key)),
      cancelled: new Set(statuses.filter((s) => s.is_cancelled).map((s) => s.key)),
    }),
    [statuses]
  );
  const doneKey = useMemo(() => activeStatuses.filter((s) => s.is_done).sort((a, b) => a.sort_order - b.sort_order)[0]?.key ?? null, [activeStatuses]);

  // Marca "agora" uma vez por montagem (as listas recarregam por realtime).
  const [now] = useState(() => Date.now());
  const rows = useMemo<Row[]>(() => {
    return tasks
      .filter((t) => !t.is_archived)
      .map((task) => {
        const slim = toSlim(task);
        const open = isOpen(slim, flags);
        return { task, slim, open, overdue: open && !!slim.dueAt && Date.parse(slim.dueAt) < now };
      });
  }, [tasks, flags, now]);

  // ── KPIs ──
  const slims = useMemo(() => rows.map((r) => r.slim), [rows]);
  const last30 = { from: shiftDate(today, -29), to: today };
  const prev30 = { from: shiftDate(today, -59), to: shiftDate(today, -30) };
  const done30 = useMemo(() => completedIn(slims, last30), [slims]); // eslint-disable-line react-hooks/exhaustive-deps
  const donePrev30 = useMemo(() => completedIn(slims, prev30), [slims]); // eslint-disable-line react-hooks/exhaustive-deps
  const weekEnd = shiftDate(today, 7);
  const counts = useMemo(() => {
    const open = rows.filter((r) => r.open);
    return {
      open: open.length,
      overdue: open.filter((r) => r.overdue).length,
      today: open.filter((r) => r.slim.dueDay === today).length,
      week: open.filter((r) => r.slim.dueDay && r.slim.dueDay >= today && r.slim.dueDay <= weekEnd).length,
      done: rows.filter((r) => !r.open && (r.slim.completedDay || flags.done.has(r.slim.status))).length,
      all: rows.length,
    };
  }, [rows, today, weekEnd, flags]);
  const spark14 = useMemo(() => {
    const out: { date: string; label: string; tip: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = shiftDate(today, -i);
      out.push({ date: d, label: shortDate(d), tip: tipDate(d), count: slims.filter((s) => s.completedDay === d).length });
    }
    return out;
  }, [slims, today]);
  const onTime30 = onTimeRate(done30);
  const onTimePrev = onTimeRate(donePrev30);
  const lead30 = leadTimeDays(done30);

  // ── Foco do dia ──
  const focus = useMemo(
    () =>
      rows
        .filter((r) => r.open && (r.overdue || (r.slim.dueDay !== null && r.slim.dueDay <= shiftDate(today, 1))))
        .sort((a, b) => Number(b.overdue) - Number(a.overdue) || PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority] || (a.slim.dueAt ?? "").localeCompare(b.slim.dueAt ?? ""))
        .slice(0, 4),
    [rows, today]
  );

  // ── Distribuições (abertas) ──
  const openRows = rows.filter((r) => r.open);
  const priorityBars = (["urgente", "alta", "media", "baixa"] as const)
    .map((p) => ({ label: PRIORITY_LABEL[p], value: openRows.filter((r) => r.task.priority === p).length, color: PRIORITY_COLOR[p] }))
    .filter((p) => p.value > 0);
  const areaSlices = useMemo(() => {
    const m = new Map<string, { name: string; color: string; value: number }>();
    openRows.forEach((r) => {
      const key = r.task.area?.id ?? "none";
      const cur = m.get(key) ?? { name: r.task.area?.name ?? "Sem área", color: r.task.area?.color ?? "#9aa7af", value: 0 };
      cur.value++;
      m.set(key, cur);
    });
    return [...m.values()].sort((a, b) => b.value - a.value);
  }, [openRows]);
  const areaOptions = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => r.task.area && m.set(r.task.area.id, r.task.area.name));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  // ── Filtro + ordenação ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (quick === "open" && !r.open) return false;
      if (quick === "overdue" && !r.overdue) return false;
      if (quick === "today" && !(r.open && r.slim.dueDay === today)) return false;
      if (quick === "week" && !(r.open && r.slim.dueDay && r.slim.dueDay >= today && r.slim.dueDay <= weekEnd)) return false;
      if (quick === "done" && r.open) return false;
      if (statusFilter && r.task.status !== statusFilter) return false;
      if (priorityFilter && r.task.priority !== priorityFilter) return false;
      if (areaFilter && (r.task.area?.id ?? "none") !== areaFilter) return false;
      if (q && !`${r.task.title} ${r.task.project?.name ?? ""} ${r.task.area?.name ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "priority") return PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority] || (a.slim.dueAt ?? "9").localeCompare(b.slim.dueAt ?? "9");
      if (sort === "recent") return Date.parse(b.task.created_at) - Date.parse(a.task.created_at);
      return (a.slim.dueAt ?? "9999").localeCompare(b.slim.dueAt ?? "9999") || PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority];
    });
  }, [rows, quick, search, statusFilter, priorityFilter, areaFilter, sort, today, weekEnd]);

  const grouped = useMemo(() => {
    const g: Record<string, Row[]> = { overdue: [], today: [], tomorrow: [], week: [], later: [], noDue: [], done: [] };
    const tomorrow = shiftDate(today, 1);
    for (const r of filtered) {
      if (!r.open) g.done.push(r);
      else if (r.overdue) g.overdue.push(r);
      else if (!r.slim.dueDay) g.noDue.push(r);
      else if (r.slim.dueDay === today) g.today.push(r);
      else if (r.slim.dueDay === tomorrow) g.tomorrow.push(r);
      else if (r.slim.dueDay <= weekEnd) g.week.push(r);
      else g.later.push(r);
    }
    return g;
  }, [filtered, today, weekEnd]);

  const hasFilter = !!(search || statusFilter || priorityFilter || areaFilter);
  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setPriorityFilter("");
    setAreaFilter("");
  }

  async function toggleDone(r: Row) {
    if (r.open && !doneKey) {
      toast.error("Nenhum status de conclusão configurado");
      return;
    }
    setBusyId(r.task.id);
    try {
      await updateTask(supabase, r.task.id, { status: r.open ? (doneKey as string) : defaultStatusKey });
      toast.success(r.open ? "Tarefa concluída" : "Tarefa reaberta");
      onRefresh();
    } catch {
      toast.error("Erro ao atualizar a tarefa");
    } finally {
      setBusyId(null);
    }
  }

  const quickChips: { key: Quick; label: string; count: number; tone?: string }[] = [
    { key: "open", label: "Abertas", count: counts.open },
    { key: "overdue", label: "Atrasadas", count: counts.overdue },
    { key: "today", label: "Hoje", count: counts.today },
    { key: "week", label: "Próx. 7 dias", count: counts.week },
    { key: "done", label: "Concluídas", count: counts.done },
    { key: "all", label: "Todas", count: counts.all },
  ];

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi label="Abertas" icon={ListTodo} value={fmt(counts.open)} color={BRAND.blue} active={quick === "open"} onClick={() => setQuick("open")} hint="Agora" />
        <Kpi label="Atrasadas" icon={AlertTriangle} value={fmt(counts.overdue)} color={BRAND.red} active={quick === "overdue"} onClick={() => setQuick("overdue")} hint={counts.overdue ? "Precisam de atenção" : "Tudo em dia"} />
        <Kpi label="Para hoje" icon={CalendarClock} value={fmt(counts.today)} color={BRAND.yellow} active={quick === "today"} onClick={() => setQuick("today")} />
        <Kpi label="Próximos 7 dias" icon={CalendarDays} value={fmt(counts.week)} color={BRAND.steel} active={quick === "week"} onClick={() => setQuick("week")} />
        <Kpi
          label="Concluídas (30 dias)" icon={CheckCircle2} value={fmt(done30.length)} current={done30.length} previous={donePrev30.length}
          spark={spark14.map((d) => d.count)} color={BRAND.green} active={quick === "done"} onClick={() => setQuick("done")}
        />
        <Kpi
          label="No prazo (30 dias)" icon={Target} value={onTime30 != null ? `${onTime30.toFixed(0)}%` : "—"} current={onTime30 ?? 0} previous={onTimePrev}
          hint={lead30 != null ? `Entrega em ${lead30.toFixed(1).replace(".", ",")} dias` : undefined} color="#8b5fbf"
        />
      </div>

      {/* Foco + gráficos */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Comece por aqui" subtitle="Atrasadas e as que vencem até amanhã, por prioridade">
          {focus.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-[color:var(--color-success)]" />
              <p className="text-sm font-semibold text-blue-900">Nada urgente por agora 🎉</p>
              <p className="text-xs text-gray-500">Aproveite para adiantar as próximas entregas.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {focus.map((r) => (
                <TaskRow key={r.task.id} row={r} today={today} onToggle={toggleDone} busy={busyId === r.task.id} compact />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Suas entregas" subtitle="Concluídas por dia nos últimos 14 dias">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={spark14} margin={{ left: -24, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={14} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
              <RTooltip content={<ChartTooltip />} cursor={{ fill: "#f4f6f8" }} />
              <Bar isAnimationActive={false} dataKey="count" name="Concluídas" fill={BRAND.green} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            <Flame className="h-3.5 w-3.5 text-[color:var(--color-warning,#e07b39)]" />
            {spark14.reduce((s, d) => s + d.count, 0)} entregas em 14 dias
          </p>
        </Panel>

        <Panel title="Em aberto" subtitle="Por prioridade e por área">
          <BarList items={priorityBars} />
          <div className="mt-4 border-t border-gray-100 pt-3">
            <Donut data={areaSlices} centerLabel="em aberto" centerValue={fmt(counts.open)} />
          </div>
        </Panel>
      </div>

      {/* Barra de ferramentas */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {quickChips.map((c) => (
              <Chip key={c.key} active={quick === c.key} onClick={() => setQuick(c.key)}>
                {c.label} <span className={cn("rounded-full px-1.5 text-[10px]", quick === c.key ? "bg-white/20" : "bg-gray-100")}>{c.count}</span>
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Tabs
              tabs={[{ key: "assigned", label: "Atribuídas a mim" }, { key: "created", label: "Criadas por mim" }]}
              active={tab}
              onChange={onTabChange}
            />
            <Tabs
              tabs={[{ key: "deadline", label: "Por prazo" }, { key: "table", label: "Tabela" }, { key: "board", label: "Quadro" }]}
              active={view}
              onChange={(k) => setView(k as View)}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative w-64 max-w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, projeto ou área"
              className="h-9 w-full rounded-[14px] border border-gray-200 bg-white pl-9 pr-3 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>
          <div className="w-40">
            <Select className="h-9" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Todos os status</option>
              {activeStatuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </div>
          <div className="w-36">
            <Select className="h-9" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="">Prioridade</option>
              {(["urgente", "alta", "media", "baixa"] as const).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </Select>
          </div>
          <div className="w-40">
            <Select className="h-9" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
              <option value="">Todas as áreas</option>
              {areaOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </Select>
          </div>
          {view !== "board" && (
            <div className="w-44">
              <Select className="h-9" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="due">Ordenar: prazo</option>
                <option value="priority">Ordenar: prioridade</option>
                <option value="recent">Ordenar: mais recentes</option>
              </Select>
            </div>
          )}
          {hasFilter && (
            <button onClick={clearFilters} className="flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-blue-900 hover:border-blue-900">
              <X className="h-3.5 w-3.5" /> Limpar
            </button>
          )}
          <span className="ml-auto text-xs text-gray-500">{filtered.length} tarefa{filtered.length === 1 ? "" : "s"}</span>
        </div>
      </Card>

      {/* Visões */}
      {filtered.length === 0 ? (
        <EmptyState
          title={hasFilter ? "Nenhuma tarefa com esses filtros" : quick === "overdue" ? "Nenhuma tarefa atrasada" : "Nenhuma tarefa por aqui"}
          description={hasFilter ? "Limpe os filtros para ver todas." : "Quando houver tarefas neste recorte, elas aparecem aqui."}
        />
      ) : view === "table" ? (
        <TaskTable tasks={filtered.map((r) => r.task)} profiles={profiles} onRefresh={onRefresh} canDelete={canDelete} />
      ) : view === "board" ? (
        <KanbanBoard tasks={filtered.map((r) => r.task)} onRefresh={onRefresh} />
      ) : (
        <div className="space-y-5">
          {BUCKETS.map((b) => {
            const list = grouped[b.key];
            if (!list.length) return null;
            const collapsed = b.key === "done" && !showDone && quick !== "done";
            return (
              <section key={b.key}>
                <button
                  onClick={() => b.key === "done" && setShowDone((v) => !v)}
                  className={cn("mb-2 flex w-full items-center gap-2 text-left", b.key === "done" && "cursor-pointer")}
                >
                  <h3 className="font-display text-[15px] font-bold text-blue-900">{b.label}</h3>
                  <Badge tone={b.tone}>{list.length}</Badge>
                  {b.key === "overdue" && <Hourglass className="h-4 w-4 text-[color:var(--color-danger)]" />}
                  {b.key === "done" && quick !== "done" && <ChevronDown className={cn("ml-auto h-4 w-4 text-gray-400 transition-transform", showDone && "rotate-180")} />}
                </button>
                {!collapsed && (
                  <div className="space-y-2">
                    {(b.key === "done" && quick !== "done" ? list.slice(0, 10) : list).map((r) => (
                      <TaskRow key={r.task.id} row={r} today={today} onToggle={toggleDone} busy={busyId === r.task.id} />
                    ))}
                    {b.key === "done" && quick !== "done" && list.length > 10 && (
                      <p className="text-center text-xs text-gray-400">Mostrando 10 de {list.length} — use o filtro “Concluídas” para ver todas.</p>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
