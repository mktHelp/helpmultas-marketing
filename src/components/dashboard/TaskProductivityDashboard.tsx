"use client";

import { useMemo, useState } from "react";
import {
  Activity, AlertTriangle, CalendarClock, CheckCircle2, Hourglass, Lightbulb, ListPlus, Target, Timer, UserX, Video, Zap,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Legend, Line, ResponsiveContainer, XAxis, YAxis,
} from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
import { Select } from "@/components/ui/Select";
import { UserAvatar } from "@/components/shared/UserAvatar";
import {
  BRAND, BarList, Chip, ChartTooltip, Donut, GRID_COLOR, Kpi, Panel, RTooltip, TICK_STYLE, fmt, shortDate, tipDate,
} from "@/components/shared/dash-parts";
import { PeriodCaption, PeriodControls, usePeriod } from "@/components/dashboard/period-controls";
import {
  PRIORITY_COLOR, PRIORITY_LABEL, buildHomeHighlights, completedIn, createdIn, dailyFlow, isOpen, isOverdueNow, leadTimeDays,
  onTimeRate, snapshotNow, teamPerformance, weekdayOf, type SlimTask, type StatusFlags,
} from "@/lib/home-analytics";
import { CONTENT_TYPE_LABEL } from "@/lib/stats";
import { cn } from "@/lib/utils";

// Dashboard de produtividade das tarefas: fluxo, entregas, prazos, equipe e
// gargalos, com filtros por área, pessoa, prioridade e tipo de conteúdo.

const pct1 = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAYS_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const PALETTE = [BRAND.blue, BRAND.yellow, BRAND.steel, BRAND.green, "#8b5fbf", "#e07b39", "#2a9d8f", "#c77dba", "#6b7a86", "#e0556b"];
const ALL = "all";

const TONE_STYLE = {
  good: "bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]",
  warn: "bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]",
  info: "bg-yellow-100 text-blue-900",
} as const;

export interface TaskDashboardProps {
  tasks: SlimTask[];
  statuses: { key: string; label: string; color: string; is_done: boolean; is_cancelled: boolean }[];
  areas: { id: string; name: string; color: string }[];
  people: { id: string; name: string; avatarUrl: string | null }[];
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">
      {label}
      <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="min-w-0">
        {children}
      </Select>
    </label>
  );
}

export function TaskProductivityDashboard({ tasks: allTasks, statuses, areas, people }: TaskDashboardProps) {
  const p = usePeriod();
  const { today, range, prevRange, closed, label } = p;
  const [flowKey, setFlowKey] = useState<"both" | "completed" | "created" | "backlog">("both");
  const [areaF, setAreaF] = useState(ALL);
  const [personF, setPersonF] = useState(ALL);
  const [prioF, setPrioF] = useState(ALL);
  const [typeF, setTypeF] = useState(ALL);

  const tasks = useMemo(
    () =>
      allTasks.filter(
        (t) =>
          (areaF === ALL || (t.areaId ?? "none") === areaF) &&
          (personF === ALL || t.assigneeIds.includes(personF)) &&
          (prioF === ALL || t.priority === prioF) &&
          (typeF === ALL || (t.contentType ?? "outros") === typeF)
      ),
    [allTasks, areaF, personF, prioF, typeF]
  );
  const filtered = areaF !== ALL || personF !== ALL || prioF !== ALL || typeF !== ALL;
  const contentTypes = useMemo(() => [...new Set(allTasks.map((t) => t.contentType ?? "outros"))].sort(), [allTasks]);

  const flags = useMemo<StatusFlags>(
    () => ({
      done: new Set(statuses.filter((s) => s.is_done).map((s) => s.key)),
      cancelled: new Set(statuses.filter((s) => s.is_cancelled).map((s) => s.key)),
    }),
    [statuses]
  );
  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);
  const personById = useMemo(() => new Map(people.map((x) => [x.id, x])), [people]);
  const areaName = (id: string | null) => (id ? (areaById.get(id)?.name ?? "Área") : "Sem área");

  const created = useMemo(() => createdIn(tasks, range), [tasks, range]);
  const done = useMemo(() => completedIn(tasks, range), [tasks, range]);
  const prevCreated = useMemo(() => createdIn(tasks, prevRange), [tasks, prevRange]);
  const prevDone = useMemo(() => completedIn(tasks, prevRange), [tasks, prevRange]);
  const onTime = useMemo(() => onTimeRate(done), [done]);
  const prevOnTime = useMemo(() => onTimeRate(prevDone), [prevDone]);
  const lead = useMemo(() => leadTimeDays(done), [done]);
  const prevLead = useMemo(() => leadTimeDays(prevDone), [prevDone]);
  const snap = useMemo(() => snapshotNow(tasks, flags, today), [tasks, flags, today]);
  const flow = useMemo(() => dailyFlow(tasks, range, flags), [tasks, range, flags]);
  const prv = (v: number | null) => (closed ? v : null);
  const spark = (get: (d: (typeof flow)[number]) => number) => flow.map(get);
  const flowData = flow.map((d) => ({ label: shortDate(d.date), tip: tipDate(d.date), created: d.created, completed: d.completed, backlog: d.backlog }));

  const openTasks = useMemo(() => tasks.filter((t) => isOpen(t, flags)), [tasks, flags]);
  const areaSlices = useMemo(() => {
    const m = new Map<string, number>();
    openTasks.forEach((t) => m.set(t.areaId ?? "none", (m.get(t.areaId ?? "none") ?? 0) + 1));
    return [...m.entries()]
      .map(([id, value], i) => ({ name: id === "none" ? "Sem área" : (areaById.get(id)?.name ?? "Área"), value, color: id === "none" ? "#9aa7af" : (areaById.get(id)?.color ?? PALETTE[i % PALETTE.length]) }))
      .sort((a, b) => b.value - a.value);
  }, [openTasks, areaById]);
  const statusBars = useMemo(
    () => statuses.map((s) => ({ label: s.label, value: tasks.filter((t) => t.status === s.key).length, color: s.color })).filter((s) => s.value > 0),
    [statuses, tasks]
  );
  const contentSlices = useMemo(() => {
    const m = new Map<string, number>();
    done.forEach((t) => m.set(t.contentType ?? "outros", (m.get(t.contentType ?? "outros") ?? 0) + 1));
    return [...m.entries()]
      .map(([k, value], i) => ({ name: k === "outros" ? "Outros" : (CONTENT_TYPE_LABEL[k] ?? k), value, color: PALETTE[i % PALETTE.length] }))
      .sort((a, b) => b.value - a.value);
  }, [done]);
  const priorityBars = (["urgente", "alta", "media", "baixa"] as const)
    .map((k) => ({ label: PRIORITY_LABEL[k], value: openTasks.filter((t) => t.priority === k).length, color: PRIORITY_COLOR[k] }))
    .filter((x) => x.value > 0);

  // Entregas por área (barras horizontais, maior primeiro).
  const doneByArea = useMemo(() => {
    const m = new Map<string, number>();
    done.forEach((t) => m.set(t.areaId ?? "none", (m.get(t.areaId ?? "none") ?? 0) + 1));
    return [...m.entries()]
      .map(([id, value]) => ({ name: id === "none" ? "Sem área" : (areaById.get(id)?.name ?? "Área"), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [done, areaById]);

  const weekday = useMemo(
    () =>
      WEEKDAYS.map((w, wd) => {
        const days = flow.filter((d) => weekdayOf(d.date) === wd);
        return {
          label: w,
          long: WEEKDAYS_LONG[wd],
          total: days.reduce((s, d) => s + d.completed, 0),
          completed: Number((days.reduce((s, d) => s + d.completed, 0) / Math.max(days.length, 1)).toFixed(1)),
          created: Number((days.reduce((s, d) => s + d.created, 0) / Math.max(days.length, 1)).toFixed(1)),
        };
      }),
    [flow]
  );
  const bestWd = weekday.reduce((m, w) => (w.completed > m.completed ? w : m), weekday[0]);

  const team = useMemo(() => teamPerformance(tasks, range, flags, people.map((x) => x.id)), [tasks, range, flags, people]);
  const maxCompleted = Math.max(...team.map((r) => r.completed), 1);
  // Entregas por pessoa separadas em no prazo / atrasadas / sem prazo.
  const teamChart = useMemo(
    () =>
      team
        .filter((r) => r.completed > 0)
        .slice(0, 12)
        .map((r) => {
          const own = done.filter((t) => t.assigneeIds.includes(r.id));
          const ok = own.filter((t) => t.dueDay && (t.completedDay as string) <= t.dueDay).length;
          const late = own.filter((t) => t.dueDay && (t.completedDay as string) > t.dueDay).length;
          return { name: personById.get(r.id)?.name.split(" ")[0] ?? "?", tip: personById.get(r.id)?.name, onTime: ok, late, noDue: own.length - ok - late, total: own.length };
        }),
    [team, done, personById]
  );

  const overdueByArea = useMemo(() => {
    const m = new Map<string, number>();
    openTasks.filter((t) => isOverdueNow(t, flags)).forEach((t) => m.set(t.areaId ?? "none", (m.get(t.areaId ?? "none") ?? 0) + 1));
    const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? { name: areaName(top[0] === "none" ? null : top[0]), overdue: top[1] } : null;
  }, [openTasks, flags, areaById]); // eslint-disable-line react-hooks/exhaustive-deps

  const highlights = useMemo(
    () =>
      buildHomeHighlights({
        snapshot: snap,
        completed: done.length,
        prevCompleted: closed ? prevDone.length : null,
        onTime,
        prevOnTime: closed ? prevOnTime : null,
        bestWeekday: bestWd && bestWd.completed > 0 ? { label: bestWd.long.charAt(0).toUpperCase() + bestWd.long.slice(1), avg: bestWd.completed } : null,
        worstArea: overdueByArea,
        topPerson: team[0] ? { name: personById.get(team[0].id)?.name ?? "", completed: team[0].completed } : null,
        label,
      }),
    [snap, done, prevDone, closed, onTime, prevOnTime, bestWd, overdueByArea, team, personById, label]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtividade — Tarefas"
        description="Entregas, prazos, ritmo e desempenho da equipe nas tarefas do Marketing."
        action={<PeriodControls p={p} />}
      />
      <PeriodCaption p={p} />

      {/* Filtros */}
      <div className="grid grid-cols-2 gap-3 rounded-[18px] border border-gray-200/80 bg-white p-4 md:grid-cols-4 lg:grid-cols-5">
        <FilterSelect label="Área" value={areaF} onChange={setAreaF}>
          <option value={ALL}>Todas as áreas</option>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          <option value="none">Sem área</option>
        </FilterSelect>
        <FilterSelect label="Colaborador" value={personF} onChange={setPersonF}>
          <option value={ALL}>Todos os colaboradores</option>
          {people.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </FilterSelect>
        <FilterSelect label="Prioridade" value={prioF} onChange={setPrioF}>
          <option value={ALL}>Todas as prioridades</option>
          {(["urgente", "alta", "media", "baixa"] as const).map((k) => <option key={k} value={k}>{PRIORITY_LABEL[k]}</option>)}
        </FilterSelect>
        <FilterSelect label="Tipo de conteúdo" value={typeF} onChange={setTypeF}>
          <option value={ALL}>Todos os tipos</option>
          {contentTypes.map((k) => <option key={k} value={k}>{k === "outros" ? "Outros / sem tipo" : (CONTENT_TYPE_LABEL[k] ?? k)}</option>)}
        </FilterSelect>
        <div className="col-span-2 flex items-end md:col-span-4 lg:col-span-1">
          <button
            type="button"
            disabled={!filtered}
            onClick={() => { setAreaF(ALL); setPersonF(ALL); setPrioF(ALL); setTypeF(ALL); }}
            className="h-10 w-full rounded-[14px] border border-gray-200 text-sm font-semibold text-blue-900 transition-colors hover:bg-gray-050 disabled:opacity-40"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Concluídas" icon={CheckCircle2} value={fmt(done.length)} current={done.length} previous={prv(prevDone.length)} spark={spark((d) => d.completed)} color={BRAND.green} active={flowKey === "completed"} onClick={() => setFlowKey("completed")} />
        <Kpi label="Criadas" icon={ListPlus} value={fmt(created.length)} current={created.length} previous={prv(prevCreated.length)} spark={spark((d) => d.created)} color={BRAND.steel} active={flowKey === "created"} onClick={() => setFlowKey("created")} />
        <Kpi label="Entregues no prazo" icon={Target} value={onTime != null ? pct1(onTime) : "—"} current={onTime ?? 0} previous={prv(prevOnTime)} hint="Das concluídas com prazo" color={BRAND.blue} />
        <Kpi label="Tempo médio de entrega" icon={Timer} value={lead != null ? `${lead.toFixed(1).replace(".", ",")} d` : "—"} current={lead ?? 0} previous={prv(prevLead)} invert hint="Da criação à conclusão" color="#8b5fbf" />
        <Kpi label="Média por dia" icon={Activity} value={(done.length / Math.max(p.length, 1)).toFixed(1).replace(".", ",")} hint="Concluídas por dia no período" color="#2a9d8f" />
        <Kpi label="Em atraso" icon={AlertTriangle} value={fmt(snap.overdue)} hint="Agora" color={BRAND.red} />
        <Kpi label="Em produção" icon={Video} value={fmt(snap.inProduction)} hint={`${fmt(snap.dueToday)} vencem hoje`} color={BRAND.yellow} />
        <Kpi label="Backlog aberto" icon={Hourglass} value={fmt(snap.open)} spark={spark((d) => d.backlog)} hint="Tarefas em aberto agora" color={BRAND.blue} active={flowKey === "backlog"} onClick={() => setFlowKey("backlog")} />
      </div>

      {/* Fluxo */}
      <Panel
        title="Fluxo de tarefas por dia"
        subtitle={`Criadas × concluídas — ${label}`}
        action={
          <div className="flex flex-wrap gap-2">
            {([["both", "Criadas × Concluídas"], ["completed", "Concluídas"], ["created", "Criadas"], ["backlog", "Backlog"]] as const).map(([k, l]) => (
              <Chip key={k} active={flowKey === k} onClick={() => setFlowKey(k)}>{l}</Chip>
            ))}
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={290}>
          {flowKey === "backlog" ? (
            <AreaChart data={flowData} margin={{ left: -10, right: 8 }}>
              <defs>
                <linearGradient id="taskBacklogFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BRAND.blue} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={BRAND.blue} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 4" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
              <RTooltip content={<ChartTooltip />} />
              <Area isAnimationActive={false} type="monotone" dataKey="backlog" name="Backlog aberto" stroke={BRAND.blue} strokeWidth={2} fill="url(#taskBacklogFill)" />
            </AreaChart>
          ) : (
            <ComposedChart data={flowData} margin={{ left: -10, right: 8 }}>
              <CartesianGrid strokeDasharray="3 4" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
              <RTooltip content={<ChartTooltip />} cursor={{ fill: "#f4f6f8" }} />
              {(flowKey === "both" || flowKey === "completed") && <Bar maxBarSize={28} isAnimationActive={false} dataKey="completed" name="Concluídas" fill={BRAND.green} radius={[4, 4, 0, 0]} />}
              {flowKey === "created" && <Bar maxBarSize={28} isAnimationActive={false} dataKey="created" name="Criadas" fill={BRAND.steel} radius={[4, 4, 0, 0]} />}
              {flowKey === "both" && <Line isAnimationActive={false} type="monotone" dataKey="created" name="Criadas" stroke={BRAND.yellow} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />}
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </Panel>

      {/* Colaborador × dia da semana */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Produtividade por colaborador" subtitle={`Concluídas no prazo, atrasadas e sem prazo — ${label}`}>
          {teamChart.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">Sem entregas neste período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={teamChart} margin={{ left: -14, right: 6, top: 18 }}>
                <CartesianGrid strokeDasharray="3 4" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="name" tick={TICK_STYLE} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                <RTooltip content={<ChartTooltip />} cursor={{ fill: "#f4f6f8" }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar stackId="d" maxBarSize={36} isAnimationActive={false} dataKey="onTime" name="No prazo" fill={BRAND.green} />
                <Bar stackId="d" maxBarSize={36} isAnimationActive={false} dataKey="late" name="Atrasadas" fill={BRAND.red} />
                <Bar stackId="d" maxBarSize={36} isAnimationActive={false} dataKey="noDue" name="Sem prazo" fill="#9aa7af" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="total"
                    content={({ x, y, width, value }) => (
                      <text x={Number(x) + Number(width) / 2} y={Number(y) - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="#243746">{value}</text>
                    )}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel title="Produtividade por dia da semana" subtitle="Total de entregas (barras) e média de criações (linha)">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={weekday} margin={{ left: -14, right: 6, top: 18 }}>
              <CartesianGrid strokeDasharray="3 4" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <RTooltip content={<ChartTooltip format={(n) => n.toFixed(Number.isInteger(n) ? 0 : 1).replace(".", ",")} />} cursor={{ fill: "#f4f6f8" }} />
              <Bar maxBarSize={40} isAnimationActive={false} dataKey="total" name="Concluídas" fill={BRAND.blue} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="total" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#243746" }} />
              </Bar>
              <Line isAnimationActive={false} type="monotone" dataKey="created" name="Criadas (média/dia)" stroke={BRAND.yellow} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Entregas por área + tipo */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Entregas por área" subtitle={`Top áreas por tarefas concluídas — ${label}`} className="lg:col-span-2">
          {doneByArea.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">Sem entregas neste período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, doneByArea.length * 34)}>
              <BarChart data={doneByArea} layout="vertical" margin={{ left: 8, right: 36 }}>
                <defs>
                  <linearGradient id="areaBar" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={BRAND.yellow} />
                    <stop offset="100%" stopColor={BRAND.steel} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 4" stroke={GRID_COLOR} horizontal={false} />
                <XAxis type="number" tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={TICK_STYLE} axisLine={false} tickLine={false} width={110} />
                <RTooltip content={<ChartTooltip />} cursor={{ fill: "#f4f6f8" }} />
                <Bar isAnimationActive={false} dataKey="value" name="Concluídas" fill="url(#areaBar)" radius={[0, 6, 6, 0]} barSize={20}>
                  <LabelList dataKey="value" position="right" style={{ fontSize: 11, fontWeight: 700, fill: "#243746" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel title="Conteúdo entregue" subtitle={`Concluídas por tipo — ${label}`}>
          <Donut data={contentSlices} centerLabel="concluídas" centerValue={fmt(done.length)} />
        </Panel>
      </div>

      {/* Situação atual */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Abertas por área" subtitle="Onde está o trabalho agora">
          <Donut data={areaSlices} centerLabel="em aberto" centerValue={fmt(snap.open)} />
        </Panel>
        <Panel title="Tarefas por status" subtitle="Panorama do fluxo">
          <BarList items={statusBars} />
        </Panel>
        <Panel title="Abertas por prioridade" subtitle="O que exige atenção">
          <BarList items={priorityBars} />
        </Panel>
      </div>

      {/* Equipe */}
      <Panel title="Desempenho da equipe" subtitle={`Entregas no período (${label}) e carga de trabalho atual`}>
        {team.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Sem dados de produtividade neste período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  <th className="pb-2">#</th>
                  <th className="pb-2">Pessoa</th>
                  <th className="pb-2">Concluídas</th>
                  <th className="pb-2 text-right">Em aberto</th>
                  <th className="pb-2 text-right">Atrasadas</th>
                  <th className="pb-2 text-right">No prazo</th>
                  <th className="pb-2 text-right">Tempo médio</th>
                </tr>
              </thead>
              <tbody>
                {team.map((r, i) => {
                  const x = personById.get(r.id);
                  return (
                    <tr key={r.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 pr-2 font-display font-bold text-blue-900">{i + 1}</td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={x?.name ?? "?"} avatarUrl={x?.avatarUrl} size="xs" />
                          <span className="font-semibold text-blue-900">{x?.name}</span>
                        </div>
                      </td>
                      <td className="w-56 py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-gray-100">
                            <div className="h-2 rounded-full bg-[color:var(--color-success)]" style={{ width: `${(r.completed / maxCompleted) * 100}%` }} />
                          </div>
                          <span className="w-7 text-right font-bold text-blue-900">{r.completed}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-blue-900">{r.open}</td>
                      <td className={cn("py-2.5 text-right", r.overdue > 0 ? "font-bold text-[color:var(--color-danger)]" : "text-gray-400")}>{r.overdue}</td>
                      <td className="py-2.5 text-right font-semibold text-blue-900">{r.onTime != null ? `${r.onTime.toFixed(0)}%` : "—"}</td>
                      <td className="py-2.5 text-right text-gray-500">{r.leadTime != null ? `${r.leadTime.toFixed(1).replace(".", ",")}d` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Gargalos + destaques */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Gargalos" subtitle="Onde o fluxo trava agora">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Atrasadas", value: snap.overdue, icon: AlertTriangle, warn: true },
              { label: "Sem responsável", value: snap.unassigned, icon: UserX, warn: true },
              { label: "Paradas +5 dias", value: snap.stuck, icon: Hourglass, warn: true },
              { label: "Aguardando aprovação", value: snap.awaitingApproval, icon: Activity, warn: true },
              { label: "Vencem hoje", value: snap.dueToday, icon: CalendarClock, warn: false },
              { label: "Em produção", value: snap.inProduction, icon: Zap, warn: false },
            ].map((g) => (
              <div key={g.label} className={cn("rounded-xl p-3", g.value > 0 && g.warn ? "bg-[color:var(--color-danger-bg)]" : "bg-gray-050")}>
                <g.icon className={cn("h-4 w-4", g.value > 0 && g.warn ? "text-[color:var(--color-danger)]" : "text-gray-400")} />
                <p className="mt-1 font-display text-2xl font-bold text-blue-900">{g.value}</p>
                <p className="text-[11px] font-semibold leading-tight text-gray-600">{g.label}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Destaques" subtitle="Leitura automática da operação" className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {highlights.map((h) => (
              <div key={h.key} className="flex gap-3 rounded-xl bg-gray-050 p-3">
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", TONE_STYLE[h.tone])}>
                  {h.tone === "warn" ? <AlertTriangle className="h-4 w-4" /> : h.tone === "good" ? <CheckCircle2 className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-900">{h.title}</p>
                  <p className="mt-0.5 text-xs leading-snug text-gray-600">{h.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
