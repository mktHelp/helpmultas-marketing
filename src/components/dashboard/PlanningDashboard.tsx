"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRightLeft, CheckCircle2, FolderKanban, Hourglass, Inbox, Lightbulb, Megaphone, Timer,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
import { UserAvatar } from "@/components/shared/UserAvatar";
import {
  BRAND, BarList, ChartTooltip, Donut, GRID_COLOR, Kpi, Panel, RTooltip, TICK_STYLE, fmt, shortDate, tipDate,
} from "@/components/shared/dash-parts";
import { CAMPAIGN_STATUS_LABELS, PROJECT_STATUS_LABELS } from "@/components/shared/StatusBadge";
import { PeriodCaption, PeriodControls, usePeriod } from "@/components/dashboard/period-controls";
import { PRIORITY_COLOR, completedIn, isOpen, type SlimTask, type StatusFlags } from "@/lib/home-analytics";
import { shiftDate, type DateRange } from "@/lib/period";
import { currencyFormatter } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CampaignStatus, ContentIdea, ProjectStatus } from "@/types/database";

// Dashboard do Planejamento: fila de tarefas em "planejamento" (entradas,
// saídas para produção e tempo parado), pautas do radar (geradas × decididas)
// e o andamento de projetos e campanhas.

const PLANNING = "planejamento";
const PROJECT_COLOR: Record<ProjectStatus, string> = { planejamento: "#7c8e98", em_andamento: BRAND.blue, pausado: "#c99400", concluido: "#2f8f5b", cancelado: "#c23b3b" };
const CAMPAIGN_COLOR: Record<CampaignStatus, string> = { planejamento: "#7c8e98", ativa: "#2f8f5b", pausada: "#c99400", encerrada: "#4a6a80" };
const FORMAT_LABEL: Record<ContentIdea["format"], string> = { reels: "Reels", feed: "Feed", carrossel: "Carrossel", stories: "Stories" };
const ACCOUNT_LABEL: Record<ContentIdea["account"], string> = { franchising: "@helpmultasfranchising", roberson: "@roberson.alvarenga" };
const FORMAT_COLOR = [BRAND.blue, BRAND.yellow, BRAND.green, "#8b5fbf"];

export interface PlanningProject {
  id: string;
  name: string;
  status: ProjectStatus;
  priority: SlimTask["priority"];
  startDay: string | null;
  endDay: string | null;
  progress: number;
  ownerId: string | null;
}
export interface PlanningCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  budget: number | null;
  startDay: string | null;
  endDay: string | null;
  ownerId: string | null;
}
export interface PlanningIdea {
  id: string;
  batchDay: string;
  decidedDay: string | null;
  status: ContentIdea["status"];
  format: ContentIdea["format"];
  account: ContentIdea["account"];
  taskId: string | null;
}
export interface PlanningMove {
  taskId: string;
  from: string | null;
  to: string | null;
  day: string;
}

export interface PlanningDashboardProps {
  tasks: SlimTask[];
  statuses: { key: string; label: string; is_done: boolean; is_cancelled: boolean }[];
  people: { id: string; name: string; avatarUrl: string | null }[];
  projects: PlanningProject[];
  campaigns: PlanningCampaign[];
  ideas: PlanningIdea[];
  moves: PlanningMove[];
}

const inRange = (d: string | null, r: DateRange) => !!d && d >= r.from && d <= r.to;
const daysBetween = (a: string, b: string) => Math.max(Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5), 0);
const dec1 = (n: number) => n.toFixed(1).replace(".", ",");

export function PlanningDashboard({ tasks, statuses, people, projects, campaigns, ideas, moves }: PlanningDashboardProps) {
  const p = usePeriod();
  const { today, range, prevRange, closed, label } = p;
  const prv = (v: number | null) => (closed ? v : null);

  const flags = useMemo<StatusFlags>(
    () => ({
      done: new Set(statuses.filter((s) => s.is_done).map((s) => s.key)),
      cancelled: new Set(statuses.filter((s) => s.is_cancelled).map((s) => s.key)),
    }),
    [statuses]
  );
  const personById = useMemo(() => new Map(people.map((x) => [x.id, x])), [people]);
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const movesByTask = useMemo(() => {
    const m = new Map<string, PlanningMove[]>();
    moves.forEach((mv) => m.set(mv.taskId, [...(m.get(mv.taskId) ?? []), mv]));
    return m;
  }, [moves]);

  // ── Fila de planejamento ──
  // Entrada = criada já em planejamento ou movida para ele; saída = movida
  // de planejamento para qualquer outra etapa.
  const entries = useMemo(() => {
    const out: { taskId: string; day: string }[] = [];
    for (const t of tasks) {
      const first = movesByTask.get(t.id)?.[0];
      const bornInPlanning = first ? first.from === PLANNING : t.status === PLANNING;
      if (bornInPlanning) out.push({ taskId: t.id, day: t.createdDay });
    }
    moves.filter((mv) => mv.to === PLANNING && taskById.has(mv.taskId)).forEach((mv) => out.push({ taskId: mv.taskId, day: mv.day }));
    return out;
  }, [tasks, moves, movesByTask, taskById]);
  const exits = useMemo(
    () =>
      moves
        .filter((mv) => mv.from === PLANNING && mv.to !== PLANNING && taskById.has(mv.taskId))
        .map((mv) => {
          const enteredAt = entries.filter((e) => e.taskId === mv.taskId && e.day <= mv.day).map((e) => e.day).sort().pop() ?? taskById.get(mv.taskId)!.createdDay;
          return { ...mv, waited: daysBetween(enteredAt, mv.day) };
        }),
    [moves, entries, taskById]
  );
  const exitsIn = (r: DateRange) => exits.filter((e) => inRange(e.day, r));
  const curExits = exitsIn(range);
  const prevExits = exitsIn(prevRange);
  const avgWait = (list: typeof exits) => (list.length ? list.reduce((s, e) => s + e.waited, 0) / list.length : null);
  const curEntries = entries.filter((e) => inRange(e.day, range));

  const queue = useMemo(
    () =>
      tasks
        .filter((t) => t.status === PLANNING && isOpen(t, flags))
        .map((t) => {
          const since = entries.filter((e) => e.taskId === t.id).map((e) => e.day).sort().pop() ?? t.createdDay;
          return { ...t, since, age: daysBetween(since, today) };
        })
        .sort((a, b) => b.age - a.age),
    [tasks, flags, entries, today]
  );
  const stale = queue.filter((t) => t.age >= 7).length;

  const flowSeries = useMemo(() => {
    const out: { label: string; tip: string; entered: number; left: number }[] = [];
    for (let d = range.from; d <= range.to; d = shiftDate(d, 1)) {
      out.push({ label: shortDate(d), tip: tipDate(d), entered: entries.filter((e) => e.day === d).length, left: exits.filter((e) => e.day === d).length });
    }
    return out;
  }, [entries, exits, range]);

  const exitTargets = useMemo(() => {
    const m = new Map<string, number>();
    curExits.forEach((e) => m.set(e.to ?? "?", (m.get(e.to ?? "?") ?? 0) + 1));
    return [...m.entries()]
      .map(([k, value]) => ({ label: statuses.find((s) => s.key === k)?.label ?? k, value, color: BRAND.blue }))
      .sort((a, b) => b.value - a.value);
  }, [curExits, statuses]);

  // ── Pautas ──
  const ideasIn = (r: DateRange) => ideas.filter((i) => inRange(i.batchDay, r));
  const curIdeas = ideasIn(range);
  const prevIdeas = ideasIn(prevRange);
  const decidedIn = (r: DateRange) => ideas.filter((i) => inRange(i.decidedDay, r));
  const approvalRate = (r: DateRange) => {
    const d = decidedIn(r);
    return d.length ? (d.filter((i) => i.status === "aprovada").length / d.length) * 100 : null;
  };
  const curApproved = decidedIn(range).filter((i) => i.status === "aprovada").length;
  const pendingIdeas = ideas.filter((i) => i.status === "nova").length;
  const ideasDelivered = ideas.filter((i) => i.taskId && completedIn([taskById.get(i.taskId)!].filter(Boolean), range).length > 0).length;

  const ideaSeries = useMemo(() => {
    const out: { label: string; tip: string; aprovada: number; descartada: number; nova: number }[] = [];
    for (let d = range.from; d <= range.to; d = shiftDate(d, 1)) {
      const day = ideas.filter((i) => i.batchDay === d);
      out.push({
        label: shortDate(d),
        tip: tipDate(d),
        aprovada: day.filter((i) => i.status === "aprovada").length,
        descartada: day.filter((i) => i.status === "descartada").length,
        nova: day.filter((i) => i.status === "nova").length,
      });
    }
    return out;
  }, [ideas, range]);
  const approvedByFormat = (Object.keys(FORMAT_LABEL) as ContentIdea["format"][])
    .map((f, i) => ({ label: FORMAT_LABEL[f], value: curIdeas.filter((x) => x.format === f && x.status === "aprovada").length, color: FORMAT_COLOR[i] }))
    .filter((x) => x.value > 0);
  const byAccount = (Object.keys(ACCOUNT_LABEL) as ContentIdea["account"][]).map((a, i) => {
    const list = curIdeas.filter((x) => x.account === a);
    return { label: ACCOUNT_LABEL[a], value: list.length, approved: list.filter((x) => x.status === "aprovada").length, color: i ? BRAND.yellow : BRAND.blue };
  });

  // ── Projetos e campanhas ──
  const tasksOf = (key: "projectId" | "campaignId", id: string) => {
    const own = tasks.filter((t) => t[key] === id);
    const open = own.filter((t) => isOpen(t, flags));
    return { total: own.length, done: own.filter((t) => t.completedDay || flags.done.has(t.status)).length, open: open.length, overdue: open.filter((t) => t.dueAt && Date.parse(t.dueAt) < Date.now()).length };
  };
  const activeProjects = projects.filter((x) => x.status === "em_andamento" || x.status === "planejamento");
  const lateProjects = activeProjects.filter((x) => x.endDay && x.endDay < today);
  
  const projectSlices = (Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[])
    .map((k) => ({ name: PROJECT_STATUS_LABELS[k], value: projects.filter((x) => x.status === k).length, color: PROJECT_COLOR[k] }))
    .filter((x) => x.value > 0);
  const activeCampaigns = campaigns.filter((c) => c.status === "ativa");
  const campaignSlices = (Object.keys(CAMPAIGN_STATUS_LABELS) as CampaignStatus[])
    .map((k) => ({ name: CAMPAIGN_STATUS_LABELS[k], value: campaigns.filter((c) => c.status === k).length, color: CAMPAIGN_COLOR[k] }))
    .filter((x) => x.value > 0);
  const projectRows = useMemo(
    () =>
      activeProjects
        .map((x) => {
          const t = tasksOf("projectId", x.id);
          // Sem progresso manual, usa a fração de tarefas concluídas.
          const progress = x.progress || (t.total ? (t.done / t.total) * 100 : 0);
          return { ...x, progress, t, late: !!x.endDay && x.endDay < today };
        })
        .sort((a, b) => Number(b.late) - Number(a.late) || (a.endDay ?? "9").localeCompare(b.endDay ?? "9")),
    [activeProjects, tasks, flags, today] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const avgProgress = projectRows.length ? projectRows.reduce((s, x) => s + x.progress, 0) / projectRows.length : null;
  const campaignRows = useMemo(
    () =>
      campaigns
        .filter((c) => c.status === "ativa" || c.status === "planejamento")
        .map((c) => ({ ...c, t: tasksOf("campaignId", c.id) }))
        .sort((a, b) => (a.endDay ?? "9").localeCompare(b.endDay ?? "9")),
    [campaigns, tasks, flags] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const dateLabel = (d: string | null) => (d ? shortDate(d) : "—");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtividade — Planejamento"
        description="Fila de planejamento, pautas do radar e andamento de projetos e campanhas."
        action={<PeriodControls p={p} />}
      />
      <PeriodCaption p={p} />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Na fila de planejamento" icon={Inbox} value={fmt(queue.length)} hint={`${fmt(stale)} paradas há 7+ dias`} color={BRAND.steel} />
        <Kpi label="Enviadas para produção" icon={ArrowRightLeft} value={fmt(curExits.length)} current={curExits.length} previous={prv(prevExits.length)} hint={`${fmt(curEntries.length)} entraram no período`} color={BRAND.green} spark={flowSeries.map((d) => d.left)} />
        <Kpi label="Tempo médio no planejamento" icon={Timer} value={avgWait(curExits) != null ? `${dec1(avgWait(curExits)!)} d` : "—"} current={avgWait(curExits) ?? 0} previous={prv(avgWait(prevExits))} invert hint="Da entrada à saída para produção" color="#8b5fbf" />
        <Kpi label="Pautas geradas" icon={Lightbulb} value={fmt(curIdeas.length)} current={curIdeas.length} previous={prv(prevIdeas.length)} hint={`${fmt(pendingIdeas)} aguardando decisão`} color={BRAND.yellow} />
        <Kpi label="Taxa de aprovação de pautas" icon={CheckCircle2} value={approvalRate(range) != null ? `${dec1(approvalRate(range)!)}%` : "—"} current={approvalRate(range) ?? 0} previous={prv(approvalRate(prevRange))} hint={`${fmt(curApproved)} aprovadas · ${fmt(ideasDelivered)} já entregues`} color={BRAND.blue} />
        <Kpi label="Projetos ativos" icon={FolderKanban} value={fmt(activeProjects.length)} hint={avgProgress != null ? `Progresso médio ${avgProgress.toFixed(0)}%` : "Em andamento ou planejamento"} color={BRAND.blue} />
        <Kpi label="Projetos atrasados" icon={AlertTriangle} value={fmt(lateProjects.length)} hint="Prazo final já passou" color={BRAND.red} />
        <Kpi label="Campanhas ativas" icon={Megaphone} value={fmt(activeCampaigns.length)} hint={`${fmt(campaigns.filter((c) => c.status === "planejamento").length)} em planejamento`} color="#2a9d8f" />
      </div>

      {/* Fluxo do planejamento */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Fluxo do planejamento" subtitle={`Entradas × saídas para produção por dia — ${label}`} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={270}>
            <ComposedChart data={flowSeries} margin={{ left: -10, right: 8 }}>
              <CartesianGrid strokeDasharray="3 4" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
              <RTooltip content={<ChartTooltip />} cursor={{ fill: "#f4f6f8" }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar maxBarSize={28} isAnimationActive={false} dataKey="left" name="Saíram para produção" fill={BRAND.green} radius={[4, 4, 0, 0]} />
              <Line isAnimationActive={false} type="monotone" dataKey="entered" name="Entraram no planejamento" stroke={BRAND.yellow} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Para onde saíram" subtitle="Etapa seguinte das tarefas que deixaram o planejamento">
          {exitTargets.length ? <BarList items={exitTargets} /> : <p className="py-10 text-center text-sm text-gray-400">Nenhuma saída no período.</p>}
        </Panel>
      </div>

      {/* Fila atual */}
      <Panel title="Fila de planejamento" subtitle="Tarefas em planejamento agora, das mais antigas para as mais novas">
        {queue.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Nada parado no planejamento. 🎉</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {queue.slice(0, 12).map((t) => {
              const a = t.assigneeIds[0] ? personById.get(t.assigneeIds[0]) : null;
              return (
                <Link key={t.id} href={`/tasks/${t.id}`} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2 transition-colors hover:border-gray-200 hover:bg-gray-050">
                  <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: PRIORITY_COLOR[t.priority] }} />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-blue-900">{t.title}</p>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", t.age >= 7 ? "bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]" : "bg-gray-100 text-gray-600")}>
                    <Hourglass className="mr-1 inline h-3 w-3" />
                    {t.age === 0 ? "hoje" : `${t.age} d`}
                  </span>
                  {a && <UserAvatar name={a.name} avatarUrl={a.avatarUrl} size="xs" />}
                </Link>
              );
            })}
          </div>
        )}
        {queue.length > 12 && <p className="mt-3 text-center text-xs text-gray-500">+ {queue.length - 12} tarefas na fila</p>}
      </Panel>

      {/* Pautas */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Pautas do radar" subtitle={`Geradas por dia e o que virou delas — ${label}`} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ideaSeries} margin={{ left: -14, right: 6 }}>
              <CartesianGrid strokeDasharray="3 4" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
              <RTooltip content={<ChartTooltip />} cursor={{ fill: "#f4f6f8" }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar stackId="i" maxBarSize={28} isAnimationActive={false} dataKey="aprovada" name="Aprovadas" fill={BRAND.green} />
              <Bar stackId="i" maxBarSize={28} isAnimationActive={false} dataKey="descartada" name="Descartadas" fill="#9aa7af" />
              <Bar stackId="i" maxBarSize={28} isAnimationActive={false} dataKey="nova" name="Sem decisão" fill={BRAND.yellow} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Pautas por conta e formato" subtitle={`Aprovadas por formato — ${label}`}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {byAccount.map((a) => (
                <div key={a.label} className="rounded-xl bg-gray-050 p-3">
                  <p className="truncate text-[11px] font-semibold text-gray-500">{a.label}</p>
                  <p className="font-display text-xl font-bold text-blue-900">{fmt(a.value)}</p>
                  <p className="text-[11px] text-gray-500">{fmt(a.approved)} aprovadas</p>
                </div>
              ))}
            </div>
            {approvedByFormat.length ? <BarList items={approvedByFormat} /> : <p className="py-4 text-center text-sm text-gray-400">Nenhuma pauta aprovada no período.</p>}
          </div>
        </Panel>
      </div>

      {/* Projetos */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Projetos por status" subtitle="Todos os projetos não arquivados">
          <Donut data={projectSlices} centerLabel="projetos" centerValue={fmt(projects.length)} />
        </Panel>
        <Panel title="Andamento dos projetos ativos" subtitle="Progresso, prazo e tarefas vinculadas" className="lg:col-span-2">
          {projectRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Nenhum projeto ativo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    <th className="pb-2">Projeto</th>
                    <th className="pb-2">Progresso</th>
                    <th className="pb-2 text-right">Tarefas</th>
                    <th className="pb-2 text-right">Atrasadas</th>
                    <th className="pb-2 text-right">Prazo</th>
                  </tr>
                </thead>
                <tbody>
                  {projectRows.map((x) => {
                    const owner = x.ownerId ? personById.get(x.ownerId) : null;
                    return (
                      <tr key={x.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2.5 pr-3">
                          <Link href={`/projects/${x.id}`} className="flex items-center gap-2 hover:underline">
                            {owner && <UserAvatar name={owner.name} avatarUrl={owner.avatarUrl} size="xs" />}
                            <span className="font-semibold text-blue-900">{x.name}</span>
                          </Link>
                        </td>
                        <td className="w-48 py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-gray-100">
                              <div className="h-2 rounded-full" style={{ width: `${Math.min(x.progress ?? 0, 100)}%`, background: PROJECT_COLOR[x.status] }} />
                            </div>
                            <span className="w-9 text-right font-bold text-blue-900">{(x.progress ?? 0).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right text-blue-900">{x.t.done}/{x.t.total}</td>
                        <td className={cn("py-2.5 text-right", x.t.overdue > 0 ? "font-bold text-[color:var(--color-danger)]" : "text-gray-400")}>{x.t.overdue}</td>
                        <td className={cn("py-2.5 text-right", x.late ? "font-bold text-[color:var(--color-danger)]" : "text-gray-500")}>{dateLabel(x.endDay)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* Campanhas */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Campanhas por status" subtitle="Todas as campanhas não arquivadas">
          <Donut data={campaignSlices} centerLabel="campanhas" centerValue={fmt(campaigns.length)} />
        </Panel>
        <Panel title="Campanhas ativas e em planejamento" subtitle="Período, verba e tarefas vinculadas" className="lg:col-span-2">
          {campaignRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Nenhuma campanha ativa.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    <th className="pb-2">Campanha</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Período</th>
                    <th className="pb-2 text-right">Verba</th>
                    <th className="pb-2 text-right">Tarefas</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignRows.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 pr-3">
                        <Link href={`/campaigns/${c.id}`} className="font-semibold text-blue-900 hover:underline">{c.name}</Link>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                          <span className="h-2 w-2 rounded-full" style={{ background: CAMPAIGN_COLOR[c.status] }} />
                          {CAMPAIGN_STATUS_LABELS[c.status]}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-gray-500">{dateLabel(c.startDay)} – {dateLabel(c.endDay)}</td>
                      <td className="py-2.5 text-right text-blue-900">{c.budget != null ? currencyFormatter.format(c.budget) : "—"}</td>
                      <td className="py-2.5 text-right text-blue-900">
                        {c.t.done}/{c.t.total}
                        {c.t.overdue > 0 && <span className="ml-1 font-bold text-[color:var(--color-danger)]">· {c.t.overdue} atras.</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
