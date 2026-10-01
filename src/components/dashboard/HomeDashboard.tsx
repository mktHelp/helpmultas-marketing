"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, ArrowUpRight, AtSign, CalendarClock, CheckCircle2, Hourglass, Lightbulb, ListPlus, ListTodo,
  Megaphone, Target, Timer, UserX, Video, Zap,
} from "lucide-react";
import {
  Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { TodayAnniversaries } from "@/components/shared/TodayAnniversaries";
import {
  BRAND, BarList, Chip, ChartTooltip, DeltaBadge, Donut, GRID_COLOR, Kpi, Panel, RTooltip, TICK_STYLE, compact, fmt, shortDate,
  signed, tipDate,
} from "@/components/shared/dash-parts";
import { currencyFormatter } from "@/lib/format";
import {
  PERIOD_OPTIONS, periodLabel, rangeForPreset, rangeLength, shiftDate, todayBRT, type DateRange, type PeriodKey,
} from "@/lib/period";
import {
  PRIORITY_COLOR, PRIORITY_LABEL, buildHomeHighlights, completedIn, createdIn, dailyFlow, isOpen, isOverdueNow, leadTimeDays,
  onTimeRate, snapshotNow, teamPerformance, weekdayOf, type SlimTask, type StatusFlags,
} from "@/lib/home-analytics";
import type { TrafficDayTotals } from "@/lib/services/meta-ads";
import { CONTENT_TYPE_LABEL } from "@/lib/stats";
import { cn } from "@/lib/utils";

// Dashboard principal do Hub: pulso do Marketing (Instagram, tráfego pago e
// produção) + operação de tarefas, com o mesmo seletor de período e
// comparação das dashboards do Instagram e do Tráfego Pago. Metas, tempo,
// seguidores e tarefas prioritárias chegam prontos do servidor (slots).

const brl = (n: number) => currencyFormatter.format(n);
const pct1 = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAYS_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const PALETTE = [BRAND.blue, BRAND.yellow, BRAND.steel, BRAND.green, "#8b5fbf", "#e07b39", "#2a9d8f", "#c77dba", "#6b7a86", "#e0556b"];

interface StatusInfo {
  key: string;
  label: string;
  color: string;
  is_done: boolean;
  is_cancelled: boolean;
}

interface Person {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface InstagramInsightDay {
  account_id: string;
  date: string;
  views: number;
  reach: number;
  total_interactions: number;
  net_followers: number;
}

export interface HomeDashboardProps {
  firstName: string;
  tasks: SlimTask[];
  statuses: StatusInfo[];
  areas: { id: string; name: string; color: string }[];
  people: Person[];
  instagram: {
    insights: InstagramInsightDay[];
    accounts: { id: string; label: string }[];
    followersNow: number | null;
    followersDelta: number | null;
  };
  traffic: TrafficDayTotals[];
  slots: { panels: React.ReactNode; priority: React.ReactNode };
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function DateField({ label, value, min, max, onChange }: { label: string; value: string; min?: string; max?: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
      {label}
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="h-9 rounded-[14px] border border-gray-200 bg-white px-3 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-yellow-500"
      />
    </label>
  );
}

// Cartão do "pulso": um resumo por frente (Instagram, Tráfego, Produção).
function PulseCard({
  title, icon: Icon, href, accent, main, mainLabel, mainCur, mainPrev, invert, spark, stats,
}: {
  title: string;
  icon: typeof AtSign;
  href: string;
  accent: string;
  main: string;
  mainLabel: string;
  mainCur: number;
  mainPrev: number | null;
  invert?: boolean;
  spark: number[];
  stats: { label: string; value: string; cur?: number; prev?: number | null; invert?: boolean }[];
}) {
  const id = `pulse-${title.replace(/\W/g, "")}`;
  return (
    <Card className="relative overflow-hidden p-0 transition-shadow hover:shadow-[var(--shadow-md)]">
      <div className="h-1.5" style={{ background: accent }} />
      <div className="p-5 pb-0">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-display text-[15px] font-bold text-blue-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: `${accent}22`, color: accent === BRAND.yellow ? "#243746" : accent }}>
              <Icon className="h-4 w-4" />
            </span>
            {title}
          </p>
          <Link href={href} className="flex items-center gap-0.5 text-xs font-semibold text-gray-500 hover:text-blue-900">
            Detalhes <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{mainLabel}</p>
            <p className="font-display text-3xl font-bold text-blue-900">{main}</p>
          </div>
          <DeltaBadge current={mainCur} previous={mainPrev} invert={invert} />
        </div>
      </div>
      <div className="h-14">
        {spark.length > 1 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 6, bottom: 0, left: 0, right: 0 }}>
              <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area isAnimationActive={false} type="monotone" dataKey="v" stroke={accent} strokeWidth={2} fill={`url(#${id})`} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100">
        {stats.map((s) => (
          <div key={s.label} className="px-3 py-2.5 text-center">
            <p className="font-display text-base font-bold text-blue-900">{s.value}</p>
            <p className="text-[10px] font-semibold uppercase text-gray-400">{s.label}</p>
            {s.cur != null && s.prev !== undefined && (
              <div className="mt-0.5 flex justify-center">
                <DeltaBadge current={s.cur} previous={s.prev} invert={s.invert} />
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

const TONE_STYLE = {
  good: "bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]",
  warn: "bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]",
  info: "bg-yellow-100 text-blue-900",
} as const;

export function HomeDashboard({ firstName, tasks, statuses, areas, people, instagram, traffic, slots }: HomeDashboardProps) {
  const today = useMemo(() => todayBRT(), []);
  const [period, setPeriod] = useState<PeriodKey>("30");
  const [custom, setCustom] = useState<DateRange>(() => ({ from: shiftDate(todayBRT(), -7), to: shiftDate(todayBRT(), -1) }));
  const [flowKey, setFlowKey] = useState<"both" | "completed" | "created" | "backlog">("both");

  const range = useMemo(() => rangeForPreset(period, custom, today), [period, custom, today]);
  const length = rangeLength(range);
  const prevRange = useMemo(() => ({ from: shiftDate(range.from, -length), to: shiftDate(range.from, -1) }), [range, length]);
  const closed = range.to < today;
  const label = periodLabel(period, range);

  const flags = useMemo<StatusFlags>(
    () => ({
      done: new Set(statuses.filter((s) => s.is_done).map((s) => s.key)),
      cancelled: new Set(statuses.filter((s) => s.is_cancelled).map((s) => s.key)),
    }),
    [statuses]
  );
  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  // ── Tarefas ──
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

  const flowData = flow.map((d) => ({ label: shortDate(d.date), tip: tipDate(d.date), created: d.created, completed: d.completed, backlog: d.backlog }));

  // ── Instagram ──
  const igDaily = useMemo(() => {
    const byDate = new Map<string, { views: number; net: number; reach: number; inter: number }>();
    for (const r of instagram.insights) {
      const cur = byDate.get(r.date) ?? { views: 0, net: 0, reach: 0, inter: 0 };
      cur.views += r.views;
      cur.net += r.net_followers;
      cur.reach += r.reach;
      cur.inter += r.total_interactions;
      byDate.set(r.date, cur);
    }
    return byDate;
  }, [instagram.insights]);
  const sumIg = (r: DateRange) => {
    let views = 0, net = 0, reach = 0, inter = 0, n = 0;
    for (let d = r.from; d <= r.to; d = shiftDate(d, 1)) {
      const row = igDaily.get(d);
      if (row) { views += row.views; net += row.net; reach += row.reach; inter += row.inter; n++; }
    }
    return { views, net, reach, inter, n };
  };
  const ig = useMemo(() => sumIg(range), [igDaily, range]); // eslint-disable-line react-hooks/exhaustive-deps
  const igPrev = useMemo(() => sumIg(prevRange), [igDaily, prevRange]); // eslint-disable-line react-hooks/exhaustive-deps
  const igHasPrev = closed && igPrev.n >= Math.ceil(length / 2);
  const igSpark: number[] = [];
  for (let d = range.from; d <= range.to; d = shiftDate(d, 1)) igSpark.push(igDaily.get(d)?.views ?? 0);
  const igLines = useMemo(() => {
    const out: Record<string, string | number>[] = [];
    for (let d = range.from; d <= range.to; d = shiftDate(d, 1)) {
      const row: Record<string, string | number> = { label: shortDate(d), tip: tipDate(d) };
      for (const a of instagram.accounts) {
        row[a.id] = instagram.insights.find((r) => r.account_id === a.id && r.date === d)?.views ?? 0;
      }
      out.push(row);
    }
    return out;
  }, [instagram, range]);

  // ── Tráfego ──
  const trafficByDate = useMemo(() => new Map(traffic.map((t) => [t.date, t])), [traffic]);
  const sumTraffic = (r: DateRange) => {
    let spend = 0, leads = 0, clicks = 0, impressions = 0, n = 0;
    for (let d = r.from; d <= r.to; d = shiftDate(d, 1)) {
      const row = trafficByDate.get(d);
      if (row) { spend += row.spend; leads += row.leads; clicks += row.clicks; impressions += row.impressions; n++; }
    }
    return { spend, leads, clicks, impressions, n };
  };
  const tr = useMemo(() => sumTraffic(range), [trafficByDate, range]); // eslint-disable-line react-hooks/exhaustive-deps
  const trPrev = useMemo(() => sumTraffic(prevRange), [trafficByDate, prevRange]); // eslint-disable-line react-hooks/exhaustive-deps
  const trHasPrev = closed && trPrev.n >= Math.ceil(length / 2);
  const trCpl = tr.leads ? tr.spend / tr.leads : 0;
  const trPrevCpl = trPrev.leads ? trPrev.spend / trPrev.leads : 0;
  const trafficSeries = useMemo(() => {
    const out: { label: string; tip: string; spend: number; leads: number }[] = [];
    for (let d = range.from; d <= range.to; d = shiftDate(d, 1)) {
      const row = trafficByDate.get(d);
      out.push({ label: shortDate(d), tip: tipDate(d), spend: Math.round((row?.spend ?? 0) * 100) / 100, leads: row?.leads ?? 0 });
    }
    return out;
  }, [trafficByDate, range]);

  // ── Distribuições ──
  const openTasks = useMemo(() => tasks.filter((t) => isOpen(t, flags)), [tasks, flags]);
  const areaSlices = useMemo(() => {
    const m = new Map<string, number>();
    openTasks.forEach((t) => m.set(t.areaId ?? "none", (m.get(t.areaId ?? "none") ?? 0) + 1));
    return [...m.entries()]
      .map(([id, value], i) => ({ name: id === "none" ? "Sem área" : (areaById.get(id)?.name ?? "Área"), value, color: id === "none" ? "#9aa7af" : (areaById.get(id)?.color ?? PALETTE[i % PALETTE.length]) }))
      .sort((a, b) => b.value - a.value);
  }, [openTasks, areaById]);
  const statusBars = useMemo(
    () =>
      statuses
        .map((s) => ({ label: s.label, value: tasks.filter((t) => t.status === s.key).length, color: s.color }))
        .filter((s) => s.value > 0),
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
    .map((p) => ({ label: PRIORITY_LABEL[p], value: openTasks.filter((t) => t.priority === p).length, color: PRIORITY_COLOR[p] }))
    .filter((p) => p.value > 0);

  // ── Dia da semana ──
  const weekday = useMemo(
    () =>
      WEEKDAYS.map((w, wd) => {
        const days = flow.filter((d) => weekdayOf(d.date) === wd);
        const n = Math.max(days.length, 1);
        return {
          label: w,
          long: WEEKDAYS_LONG[wd],
          completed: Number((days.reduce((s, d) => s + d.completed, 0) / n).toFixed(1)),
          created: Number((days.reduce((s, d) => s + d.created, 0) / n).toFixed(1)),
        };
      }),
    [flow]
  );
  const bestWd = weekday.reduce((m, w) => (w.completed > m.completed ? w : m), weekday[0]);

  // ── Equipe e agenda ──
  const team = useMemo(() => teamPerformance(tasks, range, flags, people.map((p) => p.id)), [tasks, range, flags, people]);
  const maxCompleted = Math.max(...team.map((r) => r.completed), 1);
  const overdueByArea = useMemo(() => {
    const m = new Map<string, number>();
    openTasks.filter((t) => isOverdueNow(t, flags)).forEach((t) => m.set(t.areaId ?? "none", (m.get(t.areaId ?? "none") ?? 0) + 1));
    const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? { name: top[0] === "none" ? "Sem área" : (areaById.get(top[0])?.name ?? "Uma área"), overdue: top[1] } : null;
  }, [openTasks, flags, areaById]);
  const agenda = useMemo(() => {
    const limit = shiftDate(today, 7);
    return openTasks
      .filter((t) => t.dueDay && t.dueDay <= limit)
      .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""))
      .slice(0, 8);
  }, [openTasks, today]);

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

  const dayLabel = (d: string) => (d === today ? "Hoje" : d === shiftDate(today, 1) ? "Amanhã" : d < today ? "Atrasada" : shortDate(d));
  const spark = (get: (d: (typeof flow)[number]) => number) => flow.map(get);

  const accountColors = [BRAND.blue, BRAND.yellow, BRAND.steel, BRAND.green];

  return (
    <div className="space-y-6">
      {/* Cabeçalho + período */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-blue-900">
            {greeting()}, {firstName || "time"} 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500">Visão geral do Marketing — produção, Instagram e tráfego pago em um só lugar.</p>
        </div>
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <DateField label="De" value={custom.from} max={today} onChange={(v) => setCustom((c) => ({ ...c, from: v }))} />
              <DateField label="Até" value={custom.to} max={today} onChange={(v) => setCustom((c) => ({ ...c, to: v }))} />
            </div>
          )}
          <div className="min-w-0 max-w-full overflow-x-auto">
            <Tabs tabs={PERIOD_OPTIONS} active={period} onChange={(k) => setPeriod(k as PeriodKey)} />
          </div>
        </div>
      </div>

      <TodayAnniversaries />

      <p className="-mt-3 text-xs text-gray-500">
        <span className="font-semibold text-blue-900">
          {label}
          {period !== "custom" && length > 1 ? ` · ${shortDate(range.from)} a ${shortDate(range.to)}` : ""}
        </span>
        {!closed && " · o dia de hoje é parcial (sem comparação com período anterior)"}
        {closed && ` · comparado a ${shortDate(prevRange.from)}${length > 1 ? ` – ${shortDate(prevRange.to)}` : ""}`}
      </p>

      {/* Pulso do Marketing */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <PulseCard
          title="Instagram"
          icon={AtSign}
          href="/instagram"
          accent={BRAND.blue}
          mainLabel="Visualizações"
          main={fmt(ig.views)}
          mainCur={ig.views}
          mainPrev={igHasPrev ? igPrev.views : null}
          spark={igSpark}
          stats={[
            { label: "Seguidores", value: instagram.followersNow != null ? fmt(instagram.followersNow) : "—" },
            { label: "Seg. líquidos", value: signed(ig.net) },
            { label: "Interações", value: fmt(ig.inter), cur: ig.inter, prev: igHasPrev ? igPrev.inter : null },
          ]}
        />
        <PulseCard
          title="Tráfego pago"
          icon={Megaphone}
          href="/trafego-pago/dashboard"
          accent={BRAND.yellow}
          mainLabel="Investido"
          main={brl(tr.spend)}
          mainCur={tr.spend}
          mainPrev={trHasPrev ? trPrev.spend : null}
          spark={trafficSeries.map((t) => t.spend)}
          stats={[
            { label: "Leads", value: fmt(tr.leads), cur: tr.leads, prev: trHasPrev ? trPrev.leads : null },
            { label: "CPL", value: tr.leads ? brl(trCpl) : "—", cur: trCpl, prev: trHasPrev ? trPrevCpl : null, invert: true },
            { label: "Cliques", value: fmt(tr.clicks), cur: tr.clicks, prev: trHasPrev ? trPrev.clicks : null },
          ]}
        />
        <PulseCard
          title="Produção"
          icon={ListTodo}
          href="/tasks"
          accent={BRAND.green}
          mainLabel="Tarefas concluídas"
          main={fmt(done.length)}
          mainCur={done.length}
          mainPrev={prv(prevDone.length)}
          spark={spark((d) => d.completed)}
          stats={[
            { label: "Criadas", value: fmt(created.length), cur: created.length, prev: prv(prevCreated.length) },
            { label: "No prazo", value: onTime != null ? `${onTime.toFixed(0)}%` : "—", cur: onTime ?? 0, prev: prv(prevOnTime) },
            { label: "Em aberto", value: fmt(snap.open) },
          ]}
        />
      </div>

      {/* KPIs de tarefas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Concluídas" icon={CheckCircle2} value={fmt(done.length)} current={done.length} previous={prv(prevDone.length)} spark={spark((d) => d.completed)} color={BRAND.green} active={flowKey === "completed"} onClick={() => setFlowKey("completed")} />
        <Kpi label="Criadas" icon={ListPlus} value={fmt(created.length)} current={created.length} previous={prv(prevCreated.length)} spark={spark((d) => d.created)} color={BRAND.steel} active={flowKey === "created"} onClick={() => setFlowKey("created")} />
        <Kpi label="Entregues no prazo" icon={Target} value={onTime != null ? pct1(onTime) : "—"} current={onTime ?? 0} previous={prv(prevOnTime)} hint="Das concluídas com prazo" color={BRAND.blue} />
        <Kpi label="Tempo médio de entrega" icon={Timer} value={lead != null ? `${lead.toFixed(1).replace(".", ",")} d` : "—"} current={lead ?? 0} previous={prv(prevLead)} invert hint="Da criação à conclusão" color="#8b5fbf" />
        <Kpi label="Em atraso" icon={AlertTriangle} value={fmt(snap.overdue)} hint="Agora" color={BRAND.red} />
        <Kpi label="Para hoje" icon={CalendarClock} value={fmt(snap.dueToday)} hint={`${fmt(snap.dueWeek)} nos próximos 7 dias`} color={BRAND.yellow} />
        <Kpi label="Em produção" icon={Video} value={fmt(snap.inProduction)} hint="Agora" color="#2a9d8f" />
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
                <linearGradient id="backlogFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BRAND.blue} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={BRAND.blue} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
              <RTooltip content={<ChartTooltip />} />
              <Area isAnimationActive={false} type="monotone" dataKey="backlog" name="Backlog aberto" stroke={BRAND.blue} strokeWidth={2.5} fill="url(#backlogFill)" />
            </AreaChart>
          ) : (
            <ComposedChart data={flowData} margin={{ left: -10, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
              <RTooltip content={<ChartTooltip />} cursor={{ fill: "#f4f6f8" }} />
              {(flowKey === "both" || flowKey === "completed") && <Bar isAnimationActive={false} dataKey="completed" name="Concluídas" fill={BRAND.green} radius={[4, 4, 0, 0]} />}
              {flowKey === "created" && <Bar isAnimationActive={false} dataKey="created" name="Criadas" fill={BRAND.steel} radius={[4, 4, 0, 0]} />}
              {flowKey === "both" && <Line isAnimationActive={false} type="monotone" dataKey="created" name="Criadas" stroke={BRAND.yellow} strokeWidth={2.5} dot={false} />}
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </Panel>

      {/* Distribuições */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Abertas por área" subtitle="Onde está o trabalho agora">
          <Donut data={areaSlices} centerLabel="em aberto" centerValue={fmt(snap.open)} />
        </Panel>
        <Panel title="Tarefas por status" subtitle="Panorama do fluxo">
          <BarList items={statusBars} />
        </Panel>
        <Panel title="Conteúdo entregue" subtitle={`Concluídas por tipo — ${label}`}>
          <Donut data={contentSlices} centerLabel="concluídas" centerValue={fmt(done.length)} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Ritmo por dia da semana" subtitle="Média de entregas (barras) e criações (linha)" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={weekday} margin={{ left: -14, right: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <RTooltip content={<ChartTooltip format={(n) => n.toFixed(1).replace(".", ",")} />} cursor={{ fill: "#f4f6f8" }} />
              <Bar isAnimationActive={false} dataKey="completed" name="Concluídas (média)" fill={BRAND.blue} radius={[6, 6, 0, 0]} />
              <Line isAnimationActive={false} type="monotone" dataKey="created" name="Criadas (média)" stroke={BRAND.yellow} strokeWidth={2.5} dot={{ r: 3, fill: BRAND.yellow }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Abertas por prioridade" subtitle="O que exige atenção">
          <BarList items={priorityBars} />
        </Panel>
      </div>

      {/* Metas, tempo e seguidores */}
      {slots.panels}

      {/* Instagram × Tráfego */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel
          title="Instagram — visualizações por dia"
          subtitle={`${fmt(ig.views)} visualizações · ${signed(ig.net)} seguidores líquidos`}
          action={
            <Link href="/instagram" className="flex items-center gap-0.5 text-xs font-semibold text-gray-500 hover:text-blue-900">
              Abrir <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <div className="mb-2 flex flex-wrap gap-3 text-xs font-semibold text-gray-600">
            {instagram.accounts.map((a, i) => (
              <span key={a.id} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: accountColors[i % accountColors.length] }} />
                {a.label}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={igLines} margin={{ left: -10, right: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
              <RTooltip content={<ChartTooltip />} />
              {instagram.accounts.map((a, i) => (
                <Line key={a.id} isAnimationActive={false} type="monotone" dataKey={a.id} name={a.label} stroke={accountColors[i % accountColors.length]} strokeWidth={2.5} dot={false} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
        <Panel
          title="Tráfego pago — investido × leads"
          subtitle={`${brl(tr.spend)} investidos · ${fmt(tr.leads)} leads${tr.leads ? ` · CPL ${brl(trCpl)}` : ""}`}
          action={
            <Link href="/trafego-pago/dashboard" className="flex items-center gap-0.5 text-xs font-semibold text-gray-500 hover:text-blue-900">
              Abrir <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <ResponsiveContainer width="100%" height={268}>
            <ComposedChart data={trafficSeries} margin={{ left: -6, right: -6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis yAxisId="l" tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
              <YAxis yAxisId="r" orientation="right" tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
              <RTooltip content={<ChartTooltip format={(n) => (Number.isInteger(n) ? fmt(n) : brl(n))} />} cursor={{ fill: "#f4f6f8" }} />
              <Bar isAnimationActive={false} yAxisId="l" dataKey="spend" name="Investido" fill={BRAND.blue} radius={[4, 4, 0, 0]} />
              <Line isAnimationActive={false} yAxisId="r" type="monotone" dataKey="leads" name="Leads" stroke={BRAND.yellow} strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
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
                  const p = personById.get(r.id);
                  return (
                    <tr key={r.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 pr-2 font-display font-bold text-blue-900">{i + 1}</td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={p?.name ?? "?"} avatarUrl={p?.avatarUrl} size="xs" />
                          <span className="font-semibold text-blue-900">{p?.name}</span>
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

      {/* Agenda, prioridades e gargalos */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Agenda de entregas" subtitle="Atrasadas e vencendo em até 7 dias" className="lg:col-span-1">
          {agenda.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Nada vencendo nos próximos 7 dias. 🎉</p>
          ) : (
            <div className="space-y-2">
              {agenda.map((t) => {
                const late = isOverdueNow(t, flags);
                const assignee = t.assigneeIds[0] ? personById.get(t.assigneeIds[0]) : null;
                return (
                  <Link key={t.id} href={`/tasks/${t.id}`} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2 transition-colors hover:border-gray-200 hover:bg-gray-050">
                    <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: PRIORITY_COLOR[t.priority] }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-blue-900">{t.title}</p>
                      <p className="truncate text-[11px] text-gray-500">{t.areaId ? areaById.get(t.areaId)?.name : "Sem área"}</p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", late ? "bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]" : t.dueDay === today ? "bg-yellow-100 text-blue-900" : "bg-gray-100 text-gray-600")}>
                      {late && t.dueDay !== today ? "Atrasada" : dayLabel(t.dueDay as string)}
                    </span>
                    {assignee && <UserAvatar name={assignee.name} avatarUrl={assignee.avatarUrl} size="xs" />}
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Tarefas prioritárias" subtitle="Urgentes e de alta prioridade em aberto" className="lg:col-span-1">
          {slots.priority}
        </Panel>

        <Panel title="Gargalos" subtitle="Onde o fluxo trava agora" className="lg:col-span-1">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Atrasadas", value: snap.overdue, icon: AlertTriangle },
              { label: "Sem responsável", value: snap.unassigned, icon: UserX },
              { label: "Paradas +5 dias", value: snap.stuck, icon: Hourglass },
              { label: "Aguardando aprovação", value: snap.awaitingApproval, icon: Activity },
              { label: "Vencem hoje", value: snap.dueToday, icon: CalendarClock },
              { label: "Em produção", value: snap.inProduction, icon: Zap },
            ].map((g) => (
              <div key={g.label} className={cn("rounded-xl p-3", g.value > 0 && g.label !== "Em produção" && g.label !== "Vencem hoje" ? "bg-[color:var(--color-danger-bg)]" : "bg-gray-050")}>
                <g.icon className={cn("h-4 w-4", g.value > 0 && g.label !== "Em produção" && g.label !== "Vencem hoje" ? "text-[color:var(--color-danger)]" : "text-gray-400")} />
                <p className="mt-1 font-display text-2xl font-bold text-blue-900">{g.value}</p>
                <p className="text-[11px] font-semibold leading-tight text-gray-600">{g.label}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Destaques */}
      {highlights.length > 0 && (
        <Panel title="Destaques" subtitle="Leitura automática da operação">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
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
      )}
    </div>
  );
}
