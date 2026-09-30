"use client";

import Link from "next/link";
import { ArrowUpRight, Coins, Eye, FileDown, Globe2, MousePointerClick, Percent, Repeat2, ScanEye, Target, UserPlus, Wallet } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import {
  BRAND, BarList, ChartTooltip, GRID_COLOR, Kpi, Panel, RTooltip, TICK_STYLE, compact, fmt, percent, shortDate, tipDate,
} from "@/components/shared/dash-parts";
import { currencyFormatter } from "@/lib/format";
import { connectRate, cpc, cpl, cpm, ctr, frequency, leadRate } from "@/lib/traffic-analytics";
import type { ReportModel } from "@/lib/reports-data";
import { cn } from "@/lib/utils";

const brl = (n: number) => currencyFormatter.format(n);
const pct2 = (n: number) => `${n.toFixed(2).replace(".", ",")}%`;

export function ReportsTraffic({ model, label, range }: { model: ReportModel; label: string; range: { from: string; to: string } }) {
  const tr = model.traffic;
  const t = tr.totals;
  const p = tr.prev;
  const hp = tr.hasPrevious;
  const pv = (v: number) => (hp ? v : null);

  if (!tr.has) {
    return (
      <Card className="p-10 text-center text-sm text-gray-500">
        Sem dados de tráfego pago neste período{tr.from ? ` — o histórico sincronizado começa em ${shortDate(tr.from)}/${tr.from.slice(0, 4)}` : ""}.
      </Card>
    );
  }

  const series = tr.daily.map((d) => ({ label: shortDate(d.date), tip: tipDate(d.date), spend: Math.round(d.spend * 100) / 100, leads: d.leads }));
  const weekday = tr.weekday.map((w) => ({ label: w.label, spend: Math.round(w.spend), leads: Number(w.leads.toFixed(1)) }));
  const maxImp = Math.max(t.impressions, 1);
  const fw = (v: number) => Math.max((Math.sqrt(v) / Math.sqrt(maxImp)) * 100, 2);
  const funnel = [
    { label: "Impressões", value: t.impressions, width: 100, color: BRAND.blue, rate: null as string | null },
    { label: "Cliques no link", value: t.clicks, width: fw(t.clicks), color: BRAND.steel, rate: `CTR ${pct2(ctr(t))}` },
    { label: "Visitas à LP", value: t.lpViews, width: fw(t.lpViews), color: "#2a9d8f", rate: `Conexão ${pct2(connectRate(t))}` },
    { label: "Leads", value: t.leads, width: fw(t.leads), color: BRAND.green, rate: `Conversão ${pct2(leadRate(t))}` },
  ];
  const lpCpl = tr.lpLeads > 0 ? t.spend / tr.lpLeads : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-2">
        <Link href="/trafego-pago/dashboard" className="flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-blue-900 hover:border-blue-900">
          Dashboard completa <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <a
          href={`/relatorio/trafego?period=custom&from=${range.from}&to=${range.to}&print=1`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 rounded-full bg-yellow-500 px-3 py-1.5 text-xs font-bold text-blue-900 hover:bg-yellow-600"
        >
          <FileDown className="h-3.5 w-3.5" /> PDF de tráfego
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Investido" icon={Wallet} value={brl(t.spend)} current={t.spend} previous={pv(p.spend)} spark={tr.daily.map((d) => d.spend)} color={BRAND.blue} />
        <Kpi label="Leads (Meta)" icon={UserPlus} value={fmt(t.leads)} current={t.leads} previous={pv(p.leads)} spark={tr.daily.map((d) => d.leads)} color={BRAND.green} />
        <Kpi label="Custo por lead" icon={Target} value={t.leads ? brl(cpl(t)) : "—"} current={cpl(t)} previous={pv(cpl(p))} invert color={BRAND.red} />
        <Kpi label="Impressões" icon={Eye} value={fmt(t.impressions)} current={t.impressions} previous={pv(p.impressions)} spark={tr.daily.map((d) => d.impressions)} color={BRAND.steel} />
        <Kpi label="Alcance" icon={ScanEye} value={fmt(t.reach)} current={t.reach} previous={pv(p.reach)} hint="Soma diária" color="#8b5fbf" />
        <Kpi label="Cliques no link" icon={MousePointerClick} value={fmt(t.clicks)} current={t.clicks} previous={pv(p.clicks)} spark={tr.daily.map((d) => d.clicks)} color="#e07b39" />
        <Kpi label="CTR" icon={Percent} value={pct2(ctr(t))} current={ctr(t)} previous={pv(ctr(p))} color="#2a9d8f" />
        <Kpi label="CPC" icon={Coins} value={t.clicks ? brl(cpc(t)) : "—"} current={cpc(t)} previous={pv(cpc(p))} invert color="#c77dba" hint={`CPM ${t.impressions ? brl(cpm(t)) : "—"}`} />
      </div>

      <Panel title="Investido × leads por dia" subtitle={label}>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={series} margin={{ left: -6, right: -6 }}>
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

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Funil de conversão" subtitle="Do anúncio ao lead">
          <div className="space-y-3">
            {funnel.map((f) => (
              <div key={f.label}>
                {f.rate && <p className="mb-1 ml-28 pl-3 text-[11px] font-semibold text-gray-500">↓ {f.rate}</p>}
                <div className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs font-bold text-blue-900">{f.label}</span>
                  <div className="h-7 flex-1 rounded-lg bg-gray-100">
                    <div className="h-7 rounded-lg" style={{ width: `${f.width}%`, background: f.color }} />
                  </div>
                  <span className="w-24 text-right font-display text-lg font-bold text-blue-900">{fmt(f.value)}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Dia da semana" subtitle="Média de investimento (barras) e leads (linha) nos dias com gasto">
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={weekday} margin={{ left: -6, right: -6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <YAxis yAxisId="l" tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
              <YAxis yAxisId="r" orientation="right" tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <RTooltip content={<ChartTooltip format={(n) => (n >= 50 ? brl(n) : n.toFixed(1).replace(".", ","))} />} cursor={{ fill: "#f4f6f8" }} />
              <Bar isAnimationActive={false} yAxisId="l" dataKey="spend" name="Investido (média)" fill={BRAND.blue} radius={[6, 6, 0, 0]} />
              <Line isAnimationActive={false} yAxisId="r" type="monotone" dataKey="leads" name="Leads (média)" stroke={BRAND.yellow} strokeWidth={2.5} dot={{ r: 3, fill: BRAND.yellow }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel title="Campanhas" subtitle="Ordenadas por investimento no período">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                <th className="pb-2">Campanha</th>
                <th className="pb-2 text-right">Investido</th>
                <th className="pb-2 text-right">%</th>
                <th className="pb-2 text-right">Impr.</th>
                <th className="pb-2 text-right">Cliques</th>
                <th className="pb-2 text-right">CTR</th>
                <th className="pb-2 text-right">Leads</th>
                <th className="pb-2 text-right">CPL</th>
                <th className="pb-2 text-right">Freq.</th>
              </tr>
            </thead>
            <tbody>
              {tr.campaigns.slice(0, 12).map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0">
                  <td className="max-w-[300px] py-2.5 pr-3">
                    <p className="flex items-center gap-2 font-semibold text-blue-900">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", c.active ? "bg-[color:var(--color-success)]" : "bg-gray-300")} />
                      <span className="truncate" title={c.name}>{c.name}</span>
                    </p>
                    {c.budget ? <p className="text-[11px] text-gray-400">orçamento {brl(c.budget)}/dia</p> : null}
                  </td>
                  <td className="py-2.5 text-right font-bold text-blue-900">{brl(c.m.spend)}</td>
                  <td className="py-2.5 text-right">{percent(c.m.spend, t.spend, 0)}</td>
                  <td className="py-2.5 text-right">{fmt(c.m.impressions)}</td>
                  <td className="py-2.5 text-right">{fmt(c.m.clicks)}</td>
                  <td className="py-2.5 text-right">{pct2(ctr(c.m))}</td>
                  <td className="py-2.5 text-right font-bold text-blue-900">{fmt(c.m.leads)}</td>
                  <td className="py-2.5 text-right">{c.m.leads ? brl(cpl(c.m)) : "—"}</td>
                  <td className="py-2.5 text-right">{frequency(c.m) ? frequency(c.m).toFixed(2).replace(".", ",") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Anúncios campeões" subtitle="Por leads no período (desempate pelo menor gasto)">
        {tr.ads.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Nenhum anúncio com investimento no período.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {tr.ads.slice(0, 6).map((a, i) => (
              <div key={a.id} className="overflow-hidden rounded-2xl border border-gray-200">
                <div className="relative aspect-[4/3] bg-gray-100">
                  {a.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.thumbnail_url} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
                  ) : null}
                  <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 text-xs font-bold text-blue-900 shadow">{i + 1}</span>
                </div>
                <div className="space-y-1.5 p-2.5">
                  <p className="line-clamp-2 min-h-[2rem] text-[11px] font-semibold leading-snug text-blue-900" title={a.name}>{a.name}</p>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div><p className="text-xs font-bold text-blue-900">{brl(a.m.spend)}</p><p className="text-[9px] uppercase text-gray-400">Gasto</p></div>
                    <div><p className="text-xs font-bold text-blue-900">{fmt(a.m.leads)}</p><p className="text-[9px] uppercase text-gray-400">Leads</p></div>
                    <div><p className="text-xs font-bold text-blue-900">{a.m.leads ? brl(cpl(a.m)) : "—"}</p><p className="text-[9px] uppercase text-gray-400">CPL</p></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Leads da landing page" subtitle="Recebidos pela LP e cruzados com a campanha pelas UTMs">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Leads recebidos na LP" icon={UserPlus} value={fmt(tr.lpLeads)} current={tr.lpLeads} previous={pv(tr.prevLpLeads)} color={BRAND.green} />
          <Kpi label="CPL real (LP)" icon={Target} value={tr.lpLeads ? brl(lpCpl) : "—"} hint="Investido ÷ leads da LP" color={BRAND.red} />
          <Kpi label="Visitas à LP" icon={Globe2} value={fmt(t.lpViews)} hint={`${pct2(connectRate(t))} dos cliques`} color="#2a9d8f" />
          <Kpi label="Frequência" icon={Repeat2} value={frequency(t).toFixed(2).replace(".", ",")} hint="Impressões ÷ alcance" color={BRAND.steel} />
        </div>
        {tr.lpStates.length > 0 && (
          <div className="mt-5 max-w-xl">
            <p className="mb-2 text-xs font-bold text-blue-900">Leads por estado</p>
            <BarList items={tr.lpStates} total={tr.lpLeads} color={BRAND.green} />
          </div>
        )}
      </Panel>
    </div>
  );
}
