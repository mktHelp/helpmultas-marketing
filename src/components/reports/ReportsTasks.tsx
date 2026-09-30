"use client";

import { AlertTriangle, CalendarClock, CheckCircle2, Hourglass, ListPlus, ListTodo, Target, Timer } from "lucide-react";
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";
import {
  BRAND, BarList, ChartTooltip, Donut, GRID_COLOR, Kpi, Panel, RTooltip, TICK_STYLE, fmt, shortDate, tipDate,
} from "@/components/shared/dash-parts";
import { UserAvatar } from "@/components/shared/UserAvatar";
import type { ReportModel } from "@/lib/reports-data";
import { cn } from "@/lib/utils";

const pct1 = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;
const PALETTE = [BRAND.blue, BRAND.yellow, BRAND.steel, BRAND.green, "#8b5fbf", "#e07b39", "#2a9d8f", "#c77dba"];

export function ReportsTasks({ model, label }: { model: ReportModel; label: string }) {
  const t = model.tasks;
  const p = model.closed;
  const flow = t.flow.map((d) => ({ label: shortDate(d.date), tip: tipDate(d.date), created: d.created, completed: d.completed, backlog: d.backlog }));
  const maxCompleted = Math.max(...t.team.map((r) => r.completed), 1);
  const maxArea = Math.max(...t.byArea.map((a) => a.completed + a.open), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Concluídas" icon={CheckCircle2} value={fmt(t.done)} current={t.done} previous={p ? t.prevDone : null} spark={t.flow.map((d) => d.completed)} color={BRAND.green} />
        <Kpi label="Criadas" icon={ListPlus} value={fmt(t.created)} current={t.created} previous={p ? t.prevCreated : null} spark={t.flow.map((d) => d.created)} color={BRAND.steel} />
        <Kpi label="Entregues no prazo" icon={Target} value={t.onTime != null ? pct1(t.onTime) : "—"} current={t.onTime ?? 0} previous={p ? t.prevOnTime : null} hint="Das concluídas com prazo" color={BRAND.blue} />
        <Kpi label="Tempo médio de entrega" icon={Timer} value={t.lead != null ? `${t.lead.toFixed(1).replace(".", ",")} d` : "—"} current={t.lead ?? 0} previous={p ? t.prevLead : null} invert hint="Da criação à conclusão" color="#8b5fbf" />
        <Kpi label="Em atraso" icon={AlertTriangle} value={fmt(t.snapshot.overdue)} hint="Agora" color={BRAND.red} />
        <Kpi label="Para hoje" icon={CalendarClock} value={fmt(t.snapshot.dueToday)} hint={`${fmt(t.snapshot.dueWeek)} nos próximos 7 dias`} color={BRAND.yellow} />
        <Kpi label="Em aberto" icon={ListTodo} value={fmt(t.snapshot.open)} hint={`${fmt(t.snapshot.inProduction)} em produção`} spark={t.flow.map((d) => d.backlog)} color={BRAND.blue} />
        <Kpi label="Paradas +5 dias" icon={Hourglass} value={fmt(t.snapshot.stuck)} hint={`${fmt(t.snapshot.unassigned)} sem responsável`} color="#e07b39" />
      </div>

      <Panel title="Fluxo de tarefas" subtitle={`Criadas × concluídas por dia — ${label}`}>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={flow} margin={{ left: -10, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
            <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
            <RTooltip content={<ChartTooltip />} cursor={{ fill: "#f4f6f8" }} />
            <Bar isAnimationActive={false} dataKey="completed" name="Concluídas" fill={BRAND.green} radius={[4, 4, 0, 0]} />
            <Line isAnimationActive={false} type="monotone" dataKey="created" name="Criadas" stroke={BRAND.yellow} strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Backlog ao longo do período" subtitle="Tarefas em aberto ao fim de cada dia">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={flow} margin={{ left: -10, right: 8 }}>
              <defs>
                <linearGradient id="rp-backlog" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BRAND.blue} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={BRAND.blue} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
              <RTooltip content={<ChartTooltip />} />
              <Area isAnimationActive={false} type="monotone" dataKey="backlog" name="Backlog" stroke={BRAND.blue} strokeWidth={2.5} fill="url(#rp-backlog)" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Ritmo por dia da semana" subtitle="Média de entregas (barras) e criações (linha)">
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={t.weekday} margin={{ left: -14, right: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <RTooltip content={<ChartTooltip format={(n) => n.toFixed(1).replace(".", ",")} />} cursor={{ fill: "#f4f6f8" }} />
              <Bar isAnimationActive={false} dataKey="completed" name="Concluídas (média)" fill={BRAND.blue} radius={[6, 6, 0, 0]} />
              <Line isAnimationActive={false} type="monotone" dataKey="created" name="Criadas (média)" stroke={BRAND.yellow} strokeWidth={2.5} dot={{ r: 3, fill: BRAND.yellow }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Tarefas por status" subtitle="Panorama atual">
          <BarList items={t.byStatus.map((s) => ({ label: s.label, value: s.count, color: s.color }))} />
        </Panel>
        <Panel title="Conteúdo entregue" subtitle="Concluídas por tipo no período">
          <Donut data={t.byContent.map((c, i) => ({ name: c.name, value: c.value, color: PALETTE[i % PALETTE.length] }))} centerLabel="concluídas" centerValue={fmt(t.done)} />
        </Panel>
        <Panel title="Em aberto por prioridade" subtitle="O que exige atenção">
          <BarList items={t.byPriority.map((x) => ({ label: x.label, value: x.value, color: x.color }))} />
        </Panel>
      </div>

      <Panel title="Áreas" subtitle="Concluídas no período, em aberto e atrasadas por área">
        {t.byArea.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Sem dados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  <th className="pb-2">Área</th>
                  <th className="pb-2">Volume</th>
                  <th className="pb-2 text-right">Concluídas</th>
                  <th className="pb-2 text-right">Em aberto</th>
                  <th className="pb-2 text-right">Atrasadas</th>
                </tr>
              </thead>
              <tbody>
                {t.byArea.map((a) => (
                  <tr key={a.name} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 pr-3 font-semibold text-blue-900">
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
                      {a.name}
                    </td>
                    <td className="w-64 py-2.5 pr-3">
                      <div className="flex h-2 overflow-hidden rounded-full bg-gray-100">
                        <div style={{ width: `${(a.completed / maxArea) * 100}%`, background: BRAND.green }} />
                        <div style={{ width: `${(a.open / maxArea) * 100}%`, background: BRAND.yellow }} />
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-bold text-blue-900">{a.completed}</td>
                    <td className="py-2.5 text-right text-blue-900">{a.open}</td>
                    <td className={cn("py-2.5 text-right", a.overdue ? "font-bold text-[color:var(--color-danger)]" : "text-gray-400")}>{a.overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Produtividade por responsável" subtitle={`Entregas no período (${label}) e carga de trabalho atual`}>
        {t.team.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Sem dados de produtividade neste período.</p>
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
                {t.team.map((r, i) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 pr-2 font-display font-bold text-blue-900">{i + 1}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={r.name} avatarUrl={r.avatarUrl} size="xs" />
                        <span className="font-semibold text-blue-900">{r.name}</span>
                      </div>
                    </td>
                    <td className="w-56 py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-gray-100">
                          <div className="h-2 rounded-full bg-[color:var(--color-success)]" style={{ width: `${(r.completed / maxCompleted) * 100}%` }} />
                        </div>
                        <span className="w-8 text-right font-bold text-blue-900">{r.completed}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right text-blue-900">{r.open}</td>
                    <td className={cn("py-2.5 text-right", r.overdue > 0 ? "font-bold text-[color:var(--color-danger)]" : "text-gray-400")}>{r.overdue}</td>
                    <td className="py-2.5 text-right font-semibold text-blue-900">{r.onTime != null ? `${r.onTime.toFixed(0)}%` : "—"}</td>
                    <td className="py-2.5 text-right text-gray-500">{r.leadTime != null ? `${r.leadTime.toFixed(1).replace(".", ",")}d` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {t.overdueList.length > 0 && (
        <Panel title="Tarefas em atraso" subtitle="As 8 mais antigas">
          <div className="space-y-2">
            {t.overdueList.map((o) => (
              <a key={o.id} href={`/tasks/${o.id}`} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2 hover:border-gray-200 hover:bg-gray-050">
                <span className="h-8 w-1 shrink-0 rounded-full bg-[color:var(--color-danger)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-blue-900">{o.title}</p>
                  <p className="text-[11px] text-gray-500">{o.areaName}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[color:var(--color-danger-bg)] px-2 py-0.5 text-[11px] font-bold text-[color:var(--color-danger)]">
                  vence {o.dueDay ? shortDate(o.dueDay) : "—"}
                </span>
              </a>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
