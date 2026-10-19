"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, AtSign, ClipboardList, ListTodo, Megaphone } from "lucide-react";
import {
  Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis,
} from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { TodayAnniversaries } from "@/components/shared/TodayAnniversaries";
import {
  BRAND, ChartTooltip, DeltaBadge, GRID_COLOR, Panel, RTooltip, TICK_STYLE, compact, fmt, shortDate, signed, tipDate,
} from "@/components/shared/dash-parts";
import { PeriodCaption, PeriodControls, usePeriod } from "@/components/dashboard/period-controls";
import { currencyFormatter } from "@/lib/format";
import { shiftDate, type DateRange } from "@/lib/period";
import {
  PRIORITY_COLOR, completedIn, createdIn, dailyFlow, isOpen, isOverdueNow, onTimeRate, snapshotNow, type SlimTask, type StatusFlags,
} from "@/lib/home-analytics";
import type { TrafficDayTotals } from "@/lib/services/meta-ads";
import { cn } from "@/lib/utils";

// Dashboard principal do Hub: pulso do Marketing (Instagram, tráfego pago e
// produção), agenda e prioridades. O detalhe de produtividade fica em
// /dashboard/tarefas e /dashboard/planejamento. Mesmo seletor de período e
// comparação das dashboards do Instagram e do Tráfego Pago. Metas, tempo,
// seguidores e tarefas prioritárias chegam prontos do servidor (slots).

const brl = (n: number) => currencyFormatter.format(n);

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
    <Card
      className="overflow-hidden p-0 transition-shadow hover:shadow-[var(--shadow-md)]"
      notch={
        <Link
          href={href}
          aria-label={`Ver detalhes de ${title}`}
          title="Ver detalhes"
          className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-blue-900 text-white transition-colors hover:bg-yellow-500 hover:text-blue-900"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      }
    >
      <div className="p-5 pb-0 pr-16">
        <p className="flex items-center gap-2 font-display text-[15px] font-semibold text-blue-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${accent}1f`, color: accent === BRAND.yellow ? "#a87f00" : accent }}>
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </p>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="font-display text-[28px] font-semibold leading-none tracking-tight text-blue-900 tabular-nums">{main}</p>
          <DeltaBadge current={mainCur} previous={mainPrev} invert={invert} />
        </div>
        <p className="mt-1 text-xs font-semibold text-gray-500">{mainLabel}</p>
      </div>
      <div className="h-14">
        {spark.length > 1 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 6, bottom: 0, left: 0, right: 0 }}>
              <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area isAnimationActive={false} type="monotone" dataKey="v" stroke={accent} strokeWidth={1.75} fill={`url(#${id})`} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 bg-gray-050/60">
        {stats.map((s) => (
          <div key={s.label} className="px-3 py-2.5 text-center">
            <p className="font-display text-[15px] font-semibold tabular-nums text-blue-900">{s.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{s.label}</p>
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


export function HomeDashboard({ firstName, tasks, statuses, areas, people, instagram, traffic, slots }: HomeDashboardProps) {
  const p = usePeriod();
  const { today, range, prevRange, length, closed } = p;

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
  const snap = useMemo(() => snapshotNow(tasks, flags, today), [tasks, flags, today]);
  const flow = useMemo(() => dailyFlow(tasks, range, flags), [tasks, range, flags]);
  const prv = (v: number | null) => (closed ? v : null);


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

  const openTasks = useMemo(() => tasks.filter((t) => isOpen(t, flags)), [tasks, flags]);
  const agenda = useMemo(() => {
    const limit = shiftDate(today, 7);
    return openTasks
      .filter((t) => t.dueDay && t.dueDay <= limit)
      .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""))
      .slice(0, 8);
  }, [openTasks, today]);

  const dayLabel = (d: string) => (d === today ? "Hoje" : d === shiftDate(today, 1) ? "Amanhã" : d < today ? "Atrasada" : shortDate(d));
  const spark = (get: (d: (typeof flow)[number]) => number) => flow.map(get);

  const accountColors = [BRAND.blue, BRAND.yellow, BRAND.steel, BRAND.green];

  return (
    <div className="space-y-6">
      {/* Cabeçalho + período */}
      <PageHeader
        title={`${greeting()}, ${firstName || "time"}`}
        description="Visão geral do Marketing — produção, Instagram e tráfego pago em um só lugar."
        action={<PeriodControls p={p} />}
      />

      <TodayAnniversaries />

      <PeriodCaption p={p} />

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

      {/* Atalhos para as dashboards de produtividade */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {[
          { href: "/dashboard/tarefas", icon: ListTodo, title: "Produtividade · Tarefas", text: `${fmt(done.length)} concluídas · ${onTime != null ? `${onTime.toFixed(0)}% no prazo` : "sem prazos"} · ${fmt(snap.overdue)} em atraso` },
          { href: "/dashboard/planejamento", icon: ClipboardList, title: "Produtividade · Planejamento", text: "Fila de planejamento, pautas do radar, projetos e campanhas" },
        ].map((s) => (
          <Link key={s.href} href={s.href} className="group flex items-center gap-3 rounded-[18px] border border-gray-200/80 bg-white p-4 transition-shadow hover:shadow-[var(--shadow-md)]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-900 text-white transition-colors group-hover:bg-yellow-500 group-hover:text-blue-900">
              <s.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[15px] font-semibold text-blue-900">{s.title}</p>
              <p className="truncate text-xs text-gray-500">{s.text}</p>
            </div>
            <ArrowUpRight className="h-4 w-4 text-gray-400 group-hover:text-blue-900" />
          </Link>
        ))}
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
              <CartesianGrid strokeDasharray="3 4" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
              <RTooltip content={<ChartTooltip />} />
              {instagram.accounts.map((a, i) => (
                <Line key={a.id} isAnimationActive={false} type="monotone" dataKey={a.id} name={a.label} stroke={accountColors[i % accountColors.length]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
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
              <CartesianGrid strokeDasharray="3 4" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis yAxisId="l" tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
              <YAxis yAxisId="r" orientation="right" tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
              <RTooltip content={<ChartTooltip format={(n) => (Number.isInteger(n) ? fmt(n) : brl(n))} />} cursor={{ fill: "#f4f6f8" }} />
              <Bar maxBarSize={28} isAnimationActive={false} yAxisId="l" dataKey="spend" name="Investido" fill={BRAND.blue} radius={[4, 4, 0, 0]} />
              <Line isAnimationActive={false} yAxisId="r" type="monotone" dataKey="leads" name="Leads" stroke={BRAND.yellow} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      </div>


      {/* Agenda, prioridades e gargalos */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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

      </div>

    </div>
  );
}
