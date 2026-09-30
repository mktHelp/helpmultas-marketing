"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, AtSign, CheckCircle2, Lightbulb, ListTodo, Megaphone } from "lucide-react";
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { BRAND, ChartTooltip, GRID_COLOR, Kpi, Panel, RTooltip, TICK_STYLE, compact, fmt, shortDate, signed, tipDate } from "@/components/shared/dash-parts";
import { Delta } from "@/components/shared/report-parts";
import { currencyFormatter } from "@/lib/format";
import { cpc, cpl, ctr } from "@/lib/traffic-analytics";
import type { ReportModel } from "@/lib/reports-data";
import { cn } from "@/lib/utils";

const brl = (n: number) => currencyFormatter.format(n);
const pct1 = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;

export interface SummaryRow {
  group: "Instagram" | "Tráfego pago" | "Produção";
  label: string;
  cur: number;
  prev: number | null;
  text: string;
  prevText: string;
  invert?: boolean;
}

// Tabela-resumo do período (também exportada em CSV e usada no PDF).
export function summaryRows(m: ReportModel): SummaryRow[] {
  const { instagram: ig, traffic: tr, tasks: t } = m;
  const igP = ig.hasPrevious;
  const trP = tr.hasPrevious;
  const tP = m.closed;
  const rows: SummaryRow[] = [];
  const add = (group: SummaryRow["group"], label: string, cur: number, prev: number, text: string, prevText: string, has: boolean, invert?: boolean) =>
    rows.push({ group, label, cur, prev: has ? prev : null, text, prevText: has ? prevText : "—", invert });

  add("Instagram", "Visualizações", ig.totals.views, ig.prev.views, fmt(ig.totals.views), fmt(ig.prev.views), igP);
  add("Instagram", "Contas alcançadas", ig.totals.reach, ig.prev.reach, fmt(ig.totals.reach), fmt(ig.prev.reach), igP);
  add("Instagram", "Interações", ig.totals.interactions, ig.prev.interactions, fmt(ig.totals.interactions), fmt(ig.prev.interactions), igP);
  add("Instagram", "Visitas ao perfil", ig.totals.profileViews, ig.prev.profileViews, fmt(ig.totals.profileViews), fmt(ig.prev.profileViews), igP);
  add("Instagram", "Cliques no link da bio", ig.totals.websiteClicks, ig.prev.websiteClicks, fmt(ig.totals.websiteClicks), fmt(ig.prev.websiteClicks), igP);
  add("Instagram", "Publicações (feed e reels)", ig.pubs, ig.prevPubs, fmt(ig.pubs), fmt(ig.prevPubs), igP && ig.prevPubs > 0);
  add("Instagram", "Seguidores líquidos", ig.totals.netFollowers, 0, signed(ig.totals.netFollowers), "—", false);

  add("Tráfego pago", "Investido", tr.totals.spend, tr.prev.spend, brl(tr.totals.spend), brl(tr.prev.spend), trP);
  add("Tráfego pago", "Leads (Meta)", tr.totals.leads, tr.prev.leads, fmt(tr.totals.leads), fmt(tr.prev.leads), trP);
  add("Tráfego pago", "Custo por lead", cpl(tr.totals), cpl(tr.prev), tr.totals.leads ? brl(cpl(tr.totals)) : "—", tr.prev.leads ? brl(cpl(tr.prev)) : "—", trP, true);
  add("Tráfego pago", "Impressões", tr.totals.impressions, tr.prev.impressions, fmt(tr.totals.impressions), fmt(tr.prev.impressions), trP);
  add("Tráfego pago", "Cliques no link", tr.totals.clicks, tr.prev.clicks, fmt(tr.totals.clicks), fmt(tr.prev.clicks), trP);
  add("Tráfego pago", "CTR", ctr(tr.totals), ctr(tr.prev), pct1(ctr(tr.totals)), pct1(ctr(tr.prev)), trP);
  add("Tráfego pago", "CPC", cpc(tr.totals), cpc(tr.prev), tr.totals.clicks ? brl(cpc(tr.totals)) : "—", tr.prev.clicks ? brl(cpc(tr.prev)) : "—", trP, true);
  add("Tráfego pago", "Leads recebidos na LP", tr.lpLeads, tr.prevLpLeads, fmt(tr.lpLeads), fmt(tr.prevLpLeads), trP);

  add("Produção", "Tarefas concluídas", t.done, t.prevDone, fmt(t.done), fmt(t.prevDone), tP);
  add("Produção", "Tarefas criadas", t.created, t.prevCreated, fmt(t.created), fmt(t.prevCreated), tP);
  add("Produção", "Entregues no prazo", t.onTime ?? 0, t.prevOnTime ?? 0, t.onTime != null ? pct1(t.onTime) : "—", t.prevOnTime != null ? pct1(t.prevOnTime) : "—", tP && t.onTime != null && t.prevOnTime != null);
  add("Produção", "Tempo médio de entrega (dias)", t.lead ?? 0, t.prevLead ?? 0, t.lead != null ? t.lead.toFixed(1).replace(".", ",") : "—", t.prevLead != null ? t.prevLead.toFixed(1).replace(".", ",") : "—", tP && t.lead != null && t.prevLead != null, true);
  add("Produção", "Em atraso (agora)", t.snapshot.overdue, 0, fmt(t.snapshot.overdue), "—", false);
  add("Produção", "Em aberto (agora)", t.snapshot.open, 0, fmt(t.snapshot.open), "—", false);
  return rows;
}

const AREA_STYLE = {
  Instagram: { icon: AtSign, color: BRAND.blue, href: "/instagram" },
  "Tráfego pago": { icon: Megaphone, color: BRAND.yellow, href: "/trafego-pago/dashboard" },
  Produção: { icon: ListTodo, color: BRAND.green, href: "/tasks" },
} as const;

const TONE = {
  good: "bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]",
  warn: "bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]",
  info: "bg-yellow-100 text-blue-900",
} as const;
const AREA_LABEL = { geral: "Geral", instagram: "Instagram", trafego: "Tráfego", tarefas: "Produção" } as const;

export function ReportsOverview({ model, label }: { model: ReportModel; label: string }) {
  const { instagram: ig, traffic: tr, tasks: t } = model;
  const rows = summaryRows(model);
  const igP = ig.hasPrevious;
  const trP = tr.hasPrevious;
  const tP = model.closed;
  const groups = ["Instagram", "Tráfego pago", "Produção"] as const;

  const igSeries = ig.daily.map((d) => ({ label: shortDate(d.date), tip: tipDate(d.date), views: d.views }));
  const trSeries = tr.daily.map((d) => ({ label: shortDate(d.date), tip: tipDate(d.date), spend: Math.round(d.spend * 100) / 100, leads: d.leads }));
  const flowSeries = t.flow.map((d) => ({ label: shortDate(d.date), tip: tipDate(d.date), completed: d.completed, created: d.created }));

  return (
    <div className="space-y-6">
      {(!ig.has || !tr.has) && (
        <Card className="flex items-start gap-3 border-yellow-500/40 bg-yellow-050 p-4 text-sm text-blue-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {!ig.has && "Sem dados do Instagram neste período"}
            {!ig.has && ig.from ? ` (sincronizados a partir de ${shortDate(ig.from)}/${ig.from.slice(0, 4)})` : ""}
            {!ig.has && !tr.has ? " · " : ""}
            {!tr.has && "Sem dados de tráfego pago neste período"}
            {!tr.has && tr.from ? ` (sincronizados a partir de ${shortDate(tr.from)}/${tr.from.slice(0, 4)})` : ""}.
            As seções sem dados ficam zeradas.
          </p>
        </Card>
      )}

      {/* Três frentes */}
      {groups.map((g) => {
        const style = AREA_STYLE[g];
        return (
          <section key={g}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-[17px] font-bold text-blue-900">
                <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: `${style.color}22` }}>
                  <style.icon className="h-4 w-4 text-blue-900" />
                </span>
                {g}
              </h3>
              <Link href={style.href} className="flex items-center gap-0.5 text-xs font-semibold text-gray-500 hover:text-blue-900">
                Abrir dashboard <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {g === "Instagram" && (
                <>
                  <Kpi label="Visualizações" value={fmt(ig.totals.views)} current={ig.totals.views} previous={igP ? ig.prev.views : null} spark={ig.daily.map((d) => d.views)} color={BRAND.blue} />
                  <Kpi label="Alcance" value={fmt(ig.totals.reach)} current={ig.totals.reach} previous={igP ? ig.prev.reach : null} spark={ig.daily.map((d) => d.reach)} color={BRAND.steel} />
                  <Kpi label="Interações" value={fmt(ig.totals.interactions)} current={ig.totals.interactions} previous={igP ? ig.prev.interactions : null} spark={ig.daily.map((d) => d.interactions)} color={BRAND.green} />
                  <Kpi label="Seguidores líquidos" value={signed(ig.totals.netFollowers)} hint={`${fmt(ig.pubs)} publicações · ${fmt(ig.stories)} stories`} spark={ig.daily.map((d) => d.net)} color={BRAND.yellow} />
                </>
              )}
              {g === "Tráfego pago" && (
                <>
                  <Kpi label="Investido" value={brl(tr.totals.spend)} current={tr.totals.spend} previous={trP ? tr.prev.spend : null} spark={tr.daily.map((d) => d.spend)} color={BRAND.blue} />
                  <Kpi label="Leads (Meta)" value={fmt(tr.totals.leads)} current={tr.totals.leads} previous={trP ? tr.prev.leads : null} spark={tr.daily.map((d) => d.leads)} color={BRAND.green} />
                  <Kpi label="Custo por lead" value={tr.totals.leads ? brl(cpl(tr.totals)) : "—"} current={cpl(tr.totals)} previous={trP ? cpl(tr.prev) : null} invert color={BRAND.red} />
                  <Kpi label="Cliques no link" value={fmt(tr.totals.clicks)} current={tr.totals.clicks} previous={trP ? tr.prev.clicks : null} hint={`CTR ${pct1(ctr(tr.totals))}`} spark={tr.daily.map((d) => d.clicks)} color="#e07b39" />
                </>
              )}
              {g === "Produção" && (
                <>
                  <Kpi label="Concluídas" value={fmt(t.done)} current={t.done} previous={tP ? t.prevDone : null} spark={t.flow.map((d) => d.completed)} color={BRAND.green} />
                  <Kpi label="Criadas" value={fmt(t.created)} current={t.created} previous={tP ? t.prevCreated : null} spark={t.flow.map((d) => d.created)} color={BRAND.steel} />
                  <Kpi label="Entregues no prazo" value={t.onTime != null ? pct1(t.onTime) : "—"} current={t.onTime ?? 0} previous={tP ? t.prevOnTime : null} hint="Das concluídas com prazo" color={BRAND.blue} />
                  <Kpi label="Em atraso (agora)" value={fmt(t.snapshot.overdue)} hint={`${fmt(t.snapshot.open)} em aberto`} color={BRAND.red} />
                </>
              )}
            </div>
          </section>
        );
      })}

      {/* Evolução */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Instagram" subtitle="Visualizações por dia">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={igSeries} margin={{ left: -14, right: 4 }}>
              <defs>
                <linearGradient id="rp-ig" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BRAND.blue} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={BRAND.blue} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={18} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
              <RTooltip content={<ChartTooltip />} />
              <Area isAnimationActive={false} type="monotone" dataKey="views" name="Visualizações" stroke={BRAND.blue} strokeWidth={2} fill="url(#rp-ig)" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Tráfego pago" subtitle="Investido × leads por dia">
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={trSeries} margin={{ left: -14, right: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={18} />
              <YAxis yAxisId="l" tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
              <YAxis yAxisId="r" orientation="right" tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
              <RTooltip content={<ChartTooltip format={(n) => (Number.isInteger(n) ? fmt(n) : brl(n))} />} cursor={{ fill: "#f4f6f8" }} />
              <Bar isAnimationActive={false} yAxisId="l" dataKey="spend" name="Investido" fill={BRAND.blue} radius={[3, 3, 0, 0]} />
              <Line isAnimationActive={false} yAxisId="r" type="monotone" dataKey="leads" name="Leads" stroke={BRAND.yellow} strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Produção" subtitle="Concluídas (barras) e criadas (linha)">
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={flowSeries} margin={{ left: -24, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={18} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
              <RTooltip content={<ChartTooltip />} cursor={{ fill: "#f4f6f8" }} />
              <Bar isAnimationActive={false} dataKey="completed" name="Concluídas" fill={BRAND.green} radius={[3, 3, 0, 0]} />
              <Line isAnimationActive={false} type="monotone" dataKey="created" name="Criadas" stroke={BRAND.yellow} strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Resumo em tabela */}
      <Panel title="Resumo do período" subtitle={`${label} — todos os indicadores lado a lado${model.closed ? `, comparados ao período anterior` : ""}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                <th className="pb-2">Indicador</th>
                <th className="pb-2 text-right">Período</th>
                <th className="pb-2 text-right">Anterior</th>
                <th className="pb-2 text-right">Variação</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <GroupRows key={g} group={g} rows={rows.filter((r) => r.group === g)} />
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Destaques */}
      {model.highlights.length > 0 && (
        <Panel title="Destaques consolidados" subtitle="Leitura automática de todas as frentes">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {model.highlights.map((h, i) => (
              <div key={i} className="flex gap-3 rounded-xl bg-gray-050 p-3">
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", TONE[h.tone])}>
                  {h.tone === "warn" ? <AlertTriangle className="h-4 w-4" /> : h.tone === "good" ? <CheckCircle2 className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{AREA_LABEL[h.area]}</p>
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

function GroupRows({ group, rows }: { group: SummaryRow["group"]; rows: SummaryRow[] }) {
  const style = AREA_STYLE[group];
  return (
    <>
      <tr>
        <td colSpan={4} className="pb-1 pt-4">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-900">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: style.color }} />
            {group}
          </span>
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.label} className="border-t border-gray-50">
          <td className="py-2 text-blue-900">{r.label}</td>
          <td className="py-2 text-right font-bold text-blue-900">{r.text}</td>
          <td className="py-2 text-right text-gray-500">{r.prevText}</td>
          <td className="py-2 text-right"><Delta cur={r.cur} prev={r.prev} invert={r.invert} /></td>
        </tr>
      ))}
    </>
  );
}
