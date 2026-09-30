"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { BRAND, GRID_COLOR, TICK_STYLE, compact, fmt, percent, shortDate } from "@/components/shared/dash-parts";
import { Delta, PageShell, ReportStyle, SectionTitle, avg, longDate, usePrintWhenReady } from "@/components/shared/report-parts";
import { currencyFormatter } from "@/lib/format";
import { PERIOD_OPTIONS, shiftDate, todayBRT, type DateRange, type PeriodKey } from "@/lib/period";
import type { LandingLead, TrafficStructure } from "@/lib/services/meta-ads";
import {
  buildTrafficHighlights, connectRate, cpc, cpl, cpm, ctr, dailyTM, frequency, groupTM, leadRate, rowsInRange, sumTM,
  weekdayStats, zeroTM,
} from "@/lib/traffic-analytics";

// Relatório A4 (3 páginas) do Tráfego Pago: mesmo modelo do relatório do
// Instagram (ver InstagramReport). Dados do Gerenciador de Anúncios
// sincronizados em meta_*, somente leitura.

const CHART_W = 690;
const brl = (n: number) => currencyFormatter.format(n);
const pct2 = (n: number) => `${n.toFixed(2).replace(".", ",")}%`;
const brtDay = (iso: string) => new Date(Date.parse(iso) - 3 * 3600 * 1000).toISOString().slice(0, 10);

interface Props {
  accountName: string;
  period: PeriodKey;
  range: DateRange;
  prevRange: DateRange;
  periodText: string;
  lengthDays: number;
  campaignId: string;
  campaigns: { id: string; name: string; budget: number | null; active: boolean }[];
  adSets: { id: string; campaign_id: string }[];
  ads: { id: string; adset_id: string; name: string; thumbnail_url: string }[];
  insights: TrafficStructure["insights"];
  minDate: string | null;
  leads: LandingLead[];
  prevLeads: LandingLead[];
  generatedAt: string;
  autoPrint: boolean;
}

function FunnelRow({ label, value, width, rateLabel, rate, color }: { label: string; value: number; width: number; rateLabel?: string; rate?: number; color: string }) {
  return (
    <div>
      {rateLabel && (
        <p className="mb-0.5 ml-24 pl-2 text-[9px] font-semibold text-gray-500">
          ↓ {rateLabel}: <span className="text-blue-900">{pct2(rate ?? 0)}</span>
        </p>
      )}
      <div className="flex items-center gap-2">
        <span className="w-24 shrink-0 text-[10px] font-bold text-blue-900">{label}</span>
        <div className="h-5 flex-1 rounded bg-gray-100">
          <div className="h-5 rounded" style={{ width: `${Math.max(width, 2)}%`, background: color }} />
        </div>
        <span className="w-20 text-right font-display text-sm font-bold text-blue-900">{fmt(value)}</span>
      </div>
    </div>
  );
}

export function TrafficReport(props: Props) {
  const {
    accountName, period, range, prevRange, periodText, lengthDays, campaignId, campaigns, adSets, ads, insights, minDate,
    leads, prevLeads, generatedAt, autoPrint,
  } = props;
  const router = useRouter();
  const paperRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  usePrintWhenReady(paperRef, autoPrint, mounted);

  const go = (next: { period?: PeriodKey; from?: string; to?: string; campaign?: string }) => {
    const q = new URLSearchParams({
      period: next.period ?? period,
      from: next.from ?? range.from,
      to: next.to ?? range.to,
      campaign: next.campaign ?? campaignId,
    });
    router.replace(`/relatorio/trafego?${q}`);
  };

  const today = todayBRT();
  const campaignOfAdSet = useMemo(() => new Map(adSets.map((a) => [a.id, a.campaign_id])), [adSets]);
  const adById = useMemo(() => new Map(ads.map((a) => [a.id, a])), [ads]);
  const campaignOfAd = (adId: string) => {
    const ad = adById.get(adId);
    return ad ? (campaignOfAdSet.get(ad.adset_id) ?? null) : null;
  };

  const adIds = useMemo(
    () => (campaignId ? new Set(ads.filter((a) => campaignOfAdSet.get(a.adset_id) === campaignId).map((a) => a.id)) : null),
    [campaignId, ads, campaignOfAdSet]
  );

  const curRows = useMemo(() => rowsInRange(insights, range, adIds), [insights, range, adIds]);
  const prevRows = useMemo(() => rowsInRange(insights, prevRange, adIds), [insights, prevRange, adIds]);
  const t = useMemo(() => sumTM(curRows), [curRows]);
  const p = useMemo(() => sumTM(prevRows), [prevRows]);
  const hasPrevious = range.to < today && !!minDate && minDate <= prevRange.from && prevRows.length > 0;
  const pv = (v: number) => (hasPrevious ? v : null);

  const daily = useMemo(() => dailyTM(curRows, range), [curRows, range]);
  const weekday = useMemo(() => weekdayStats(daily), [daily]);
  const adTM = useMemo(() => groupTM(curRows, (id) => id), [curRows]);
  const campaignTM = useMemo(() => groupTM(curRows, (id) => campaignOfAd(id)), [curRows]); // eslint-disable-line react-hooks/exhaustive-deps

  const scopedAds = useMemo(() => ads.filter((a) => !adIds || adIds.has(a.id)), [ads, adIds]);
  const highlights = useMemo(
    () =>
      buildTrafficHighlights({
        totals: t,
        previous: hasPrevious ? p : null,
        ads: scopedAds.map((a) => ({ id: a.id, name: a.name, m: adTM.get(a.id) ?? zeroTM() })),
        campaigns: campaigns.map((c) => ({ id: c.id, name: c.name, m: campaignTM.get(c.id) ?? zeroTM() })),
        weekday,
      }).slice(0, 6),
    [t, p, hasPrevious, scopedAds, adTM, campaigns, campaignTM, weekday]
  );

  const chartDaily = daily.map((d) => ({ label: shortDate(d.date), spend: Math.round(d.spend * 100) / 100, leads: d.leads, cpl: d.leads > 0 ? d.spend / d.leads : 0 }));
  const cplDaily = chartDaily.map((d) => ({ label: d.label, cpl: Math.round(d.cpl * 100) / 100 }));
  const weekdayData = weekday.map((w) => ({ label: w.label, spend: Math.round(w.spend), leads: Number(w.leads.toFixed(1)) }));

  const campaignRows = campaigns
    .filter((c) => !campaignId || c.id === campaignId)
    .map((c) => ({ c, m: campaignTM.get(c.id) ?? zeroTM() }))
    .filter((x) => x.m.spend > 0)
    .sort((a, b) => b.m.spend - a.m.spend)
    .slice(0, 8);

  const pacing = campaigns
    .filter((c) => c.active && c.budget && c.budget > 0 && (!campaignId || c.id === campaignId) && (campaignTM.get(c.id)?.spend ?? 0) > 0)
    .map((c) => {
      const avgDaily = (campaignTM.get(c.id)?.spend ?? 0) / Math.max(lengthDays, 1);
      return { id: c.id, name: c.name, avg: avgDaily, budget: c.budget as number, ratio: avgDaily / (c.budget as number) };
    })
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5);

  const topAds = scopedAds
    .map((a) => ({ a, m: adTM.get(a.id) ?? zeroTM() }))
    .filter((x) => x.m.spend > 0)
    .sort((x, y) => y.m.leads - x.m.leads || x.m.spend - y.m.spend)
    .slice(0, 6);

  // Leads da LP
  const inScope = (l: LandingLead) => !campaignId || l.matched_campaign_id === campaignId;
  const lpCur = leads.filter(inScope);
  const lpPrev = prevLeads.filter(inScope);
  const lpByDay = useMemo(() => {
    const counts = new Map<string, number>();
    lpCur.forEach((l) => counts.set(brtDay(l.received_at), (counts.get(brtDay(l.received_at)) ?? 0) + 1));
    const out: { label: string; leads: number }[] = [];
    for (let d = range.from; d <= range.to; d = shiftDate(d, 1)) out.push({ label: shortDate(d), leads: counts.get(d) ?? 0 });
    return out;
  }, [lpCur, range]);
  const lpStates = useMemo(() => {
    const m = new Map<string, number>();
    lpCur.forEach((l) => {
      const k = l.state?.trim().toUpperCase() || "Não informado";
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [lpCur]);
  const campaignName = new Map(campaigns.map((c) => [c.id, c.name]));
  const lpCampaigns = useMemo(() => {
    const m = new Map<string, number>();
    lpCur.forEach((l) => {
      const k = l.matched_campaign_id ? (campaignName.get(l.matched_campaign_id) ?? "Campanha removida") : "Sem campanha identificada";
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [lpCur]); // eslint-disable-line react-hooks/exhaustive-deps
  const lpCpl = lpCur.length > 0 ? t.spend / lpCur.length : 0;
  const prevLpCpl = lpPrev.length > 0 && p.spend > 0 ? p.spend / lpPrev.length : 0;
  const matched = lpCur.filter((l) => l.matched_ad_id).length;

  const maxImp = Math.max(t.impressions, 1);
  const fw = (v: number) => (Math.sqrt(v) / Math.sqrt(maxImp)) * 100;

  const indicators: { label: string; cur: number; prev: number | null; text: string; prevText: string; invert?: boolean }[] = [
    { label: "Investido", cur: t.spend, prev: pv(p.spend), text: brl(t.spend), prevText: hasPrevious ? brl(p.spend) : "—" },
    { label: "Leads (Meta)", cur: t.leads, prev: pv(p.leads), text: fmt(t.leads), prevText: hasPrevious ? fmt(p.leads) : "—" },
    { label: "Custo por lead", cur: cpl(t), prev: pv(cpl(p)), text: t.leads ? brl(cpl(t)) : "—", prevText: hasPrevious && p.leads ? brl(cpl(p)) : "—", invert: true },
    { label: "Impressões", cur: t.impressions, prev: pv(p.impressions), text: fmt(t.impressions), prevText: hasPrevious ? fmt(p.impressions) : "—" },
    { label: "Alcance (soma diária)", cur: t.reach, prev: pv(p.reach), text: fmt(t.reach), prevText: hasPrevious ? fmt(p.reach) : "—" },
    { label: "Cliques no link", cur: t.clicks, prev: pv(p.clicks), text: fmt(t.clicks), prevText: hasPrevious ? fmt(p.clicks) : "—" },
    { label: "CTR", cur: ctr(t), prev: pv(ctr(p)), text: pct2(ctr(t)), prevText: hasPrevious ? pct2(ctr(p)) : "—" },
    { label: "CPC", cur: cpc(t), prev: pv(cpc(p)), text: t.clicks ? brl(cpc(t)) : "—", prevText: hasPrevious && p.clicks ? brl(cpc(p)) : "—", invert: true },
    { label: "CPM", cur: cpm(t), prev: pv(cpm(p)), text: t.impressions ? brl(cpm(t)) : "—", prevText: hasPrevious && p.impressions ? brl(cpm(p)) : "—", invert: true },
    { label: "Frequência", cur: frequency(t), prev: pv(frequency(p)), text: frequency(t).toFixed(2).replace(".", ","), prevText: hasPrevious ? frequency(p).toFixed(2).replace(".", ",") : "—", invert: true },
    { label: "Visitas à landing page", cur: t.lpViews, prev: pv(p.lpViews), text: fmt(t.lpViews), prevText: hasPrevious ? fmt(p.lpViews) : "—" },
    { label: "Conversão da LP (leads ÷ visitas)", cur: leadRate(t), prev: pv(leadRate(p)), text: pct2(leadRate(t)), prevText: hasPrevious ? pct2(leadRate(p)) : "—" },
  ];

  const total = 3;
  const footer = `Help Multas · Relatório de Tráfego Pago · ${accountName}`;
  const campaignLabel = campaignId ? (campaignName.get(campaignId) ?? "") : "Todas as campanhas";

  return (
    <div className="report-root">
      <ReportStyle />

      <div className="no-print sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <Button size="sm" variant="secondary" onClick={() => router.push("/trafego-pago/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Tráfego Pago
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-64">
            <Select value={campaignId} onChange={(e) => go({ campaign: e.target.value })}>
              <option value="">Todas as campanhas</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Select value={period} onChange={(e) => go({ period: e.target.value as PeriodKey })}>
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </Select>
          </div>
          {period === "custom" && (
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
              <input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && go({ from: e.target.value })} className="h-10 rounded-[14px] border border-gray-200 px-3 text-sm text-blue-900" />
              até
              <input type="date" value={range.to} min={range.from} max={today} onChange={(e) => e.target.value && go({ to: e.target.value })} className="h-10 rounded-[14px] border border-gray-200 px-3 text-sm text-blue-900" />
            </div>
          )}
          <Button size="sm" onClick={() => window.print()}>
            <Download className="h-4 w-4" />
            Baixar PDF
          </Button>
        </div>
      </div>

      <div ref={paperRef}>
        {/* ── Página 1: resumo ── */}
        <PageShell n={1} total={total} footer={footer}>
          <header className="-mx-[12mm] -mt-[12mm] mb-5 flex items-center gap-4 bg-blue-900 px-[12mm] py-6 text-white">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-500">Relatório de tráfego pago · Meta Ads</p>
              <h1 className="truncate font-display text-2xl font-bold leading-tight">{accountName}</h1>
              <p className="truncate text-sm text-blue-100">{campaignLabel}</p>
            </div>
            <div className="text-right text-xs text-blue-100">
              <p className="text-[10px] uppercase tracking-wide text-blue-200">Período</p>
              <p className="text-sm font-bold text-white">{range.from === range.to ? longDate(range.from) : `${longDate(range.from)} a ${longDate(range.to)}`}</p>
              <p>{lengthDays > 1 && period === "custom" ? `${lengthDays} dias` : periodText}</p>
            </div>
          </header>

          <div className="mb-5 grid grid-cols-4 gap-3">
            {[
              { label: "Investido", value: brl(t.spend), cur: t.spend, prev: pv(p.spend), invert: false },
              { label: "Leads (Meta)", value: fmt(t.leads), cur: t.leads, prev: pv(p.leads), invert: false },
              { label: "Custo por lead", value: t.leads ? brl(cpl(t)) : "—", cur: cpl(t), prev: pv(cpl(p)), invert: true },
              { label: "Impressões", value: fmt(t.impressions), cur: t.impressions, prev: pv(p.impressions), invert: false },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-gray-200 bg-gray-050 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{k.label}</p>
                <p className="mt-1 font-display text-xl font-bold text-blue-900">{k.value}</p>
                <p className="mt-0.5 min-h-[14px] text-[10px] text-gray-500">
                  {k.prev != null ? <><Delta cur={k.cur} prev={k.prev} invert={k.invert} /> <span>vs. período anterior</span></> : ""}
                </p>
              </div>
            ))}
          </div>

          <SectionTitle hint={hasPrevious ? `Comparado a ${longDate(prevRange.from)}${prevRange.from === prevRange.to ? "" : ` – ${longDate(prevRange.to)}`}` : range.to >= today ? "Hoje é parcial — sem comparação" : "Sem período anterior sincronizado"}>
            Indicadores do período
          </SectionTitle>
          <table className="mb-4 w-full text-[11px]">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-gray-500">
                <th className="py-1">Indicador</th>
                <th className="py-1 text-right">Período</th>
                <th className="py-1 text-right">Anterior</th>
                <th className="py-1 text-right">Variação</th>
              </tr>
            </thead>
            <tbody>
              {indicators.map((i) => (
                <tr key={i.label} className="border-t border-gray-100">
                  <td className="py-1 font-semibold text-blue-900">{i.label}</td>
                  <td className="py-1 text-right font-bold text-blue-900">{i.text}</td>
                  <td className="py-1 text-right text-gray-500">{i.prevText}</td>
                  <td className="py-1 text-right"><Delta cur={i.cur} prev={i.prev} invert={i.invert} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <SectionTitle>Funil de conversão</SectionTitle>
          <div className="mb-4 space-y-1.5">
            <FunnelRow label="Impressões" value={t.impressions} width={100} color={BRAND.blue} />
            <FunnelRow label="Cliques no link" value={t.clicks} width={fw(t.clicks)} rateLabel="CTR" rate={ctr(t)} color={BRAND.steel} />
            <FunnelRow label="Visitas à LP" value={t.lpViews} width={fw(t.lpViews)} rateLabel="Conexão (visita ÷ clique)" rate={connectRate(t)} color="#2a9d8f" />
            <FunnelRow label="Leads" value={t.leads} width={fw(t.leads)} rateLabel="Conversão da LP" rate={leadRate(t)} color={BRAND.green} />
          </div>

          <SectionTitle>Destaques do período</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {highlights.map((h) => (
              <div key={h.key + h.title} className="rounded-lg border-l-4 border-yellow-500 bg-gray-050 px-3 py-1.5">
                <p className="text-[11px] font-bold text-blue-900">{h.title}</p>
                <p className="mt-0.5 text-[10px] leading-snug text-gray-600">{h.text}</p>
              </div>
            ))}
          </div>
        </PageShell>

        {/* ── Página 2: desempenho ── */}
        <PageShell n={2} total={total} footer={footer}>
          <SectionTitle hint={`Média de ${brl(avg(daily.map((d) => d.spend)))} e ${avg(daily.map((d) => d.leads)).toFixed(1).replace(".", ",")} leads por dia`}>
            Investido × leads por dia
          </SectionTitle>
          <div className="mb-5">
            {mounted && (
              <ComposedChart width={CHART_W} height={200} data={chartDaily} margin={{ left: -6, right: -6, top: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={18} />
                <YAxis yAxisId="l" tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
                <YAxis yAxisId="r" orientation="right" tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                <Bar yAxisId="l" dataKey="spend" fill={BRAND.blue} isAnimationActive={false} radius={[3, 3, 0, 0]} />
                <Line yAxisId="r" type="monotone" dataKey="leads" stroke={BRAND.yellow} strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </ComposedChart>
            )}
            <p className="mt-1 text-center text-[9px] text-gray-500"><span style={{ color: BRAND.blue }}>■</span> Investido (R$) &nbsp; <span style={{ color: BRAND.yellow }}>━</span> Leads</p>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-5">
            <div>
              <SectionTitle hint={t.leads ? `Médio ${brl(cpl(t))}` : ""}>Custo por lead por dia</SectionTitle>
              {mounted && (
                <ComposedChart width={330} height={170} data={cplDaily} margin={{ left: -14, right: 4, top: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
                  <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
                  <Line type="monotone" dataKey="cpl" stroke={BRAND.red} strokeWidth={2} dot={false} isAnimationActive={false} />
                </ComposedChart>
              )}
            </div>
            <div>
              <SectionTitle>Por dia da semana</SectionTitle>
              {mounted && (
                <ComposedChart width={330} height={170} data={weekdayData} margin={{ left: -14, right: -10, top: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="l" tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
                  <YAxis yAxisId="r" orientation="right" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                  <Bar yAxisId="l" dataKey="spend" fill={BRAND.blue} isAnimationActive={false} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="r" type="monotone" dataKey="leads" stroke={BRAND.yellow} strokeWidth={2.5} dot={{ r: 3, fill: BRAND.yellow }} isAnimationActive={false} />
                </ComposedChart>
              )}
              <p className="text-center text-[9px] text-gray-500">Média de investimento (barras) e leads (linha) nos dias com gasto</p>
            </div>
          </div>

          <SectionTitle hint="Top 8 por investimento">Desempenho por campanha</SectionTitle>
          <table className="w-full text-[10.5px]">
            <thead>
              <tr className="text-left text-[9px] font-bold uppercase tracking-wide text-gray-500">
                <th className="py-1">Campanha</th>
                <th className="py-1 text-right">Investido</th>
                <th className="py-1 text-right">%</th>
                <th className="py-1 text-right">Impr.</th>
                <th className="py-1 text-right">CTR</th>
                <th className="py-1 text-right">Leads</th>
                <th className="py-1 text-right">CPL</th>
                <th className="py-1 text-right">Freq.</th>
              </tr>
            </thead>
            <tbody>
              {campaignRows.map(({ c, m }) => (
                <tr key={c.id} className="border-t border-gray-100 align-top">
                  <td className="max-w-[230px] py-1.5 pr-2 font-semibold leading-tight text-blue-900">
                    {c.name}
                    {c.budget ? <span className="block text-[9px] font-normal text-gray-400">orçamento {brl(c.budget)}/dia</span> : null}
                  </td>
                  <td className="py-1.5 text-right font-bold text-blue-900">{brl(m.spend)}</td>
                  <td className="py-1.5 text-right">{percent(m.spend, t.spend, 0)}</td>
                  <td className="py-1.5 text-right">{fmt(m.impressions)}</td>
                  <td className="py-1.5 text-right">{pct2(ctr(m))}</td>
                  <td className="py-1.5 text-right font-bold text-blue-900">{fmt(m.leads)}</td>
                  <td className="py-1.5 text-right">{m.leads ? brl(cpl(m)) : "—"}</td>
                  <td className="py-1.5 text-right">{frequency(m) ? frequency(m).toFixed(2).replace(".", ",") : "—"}</td>
                </tr>
              ))}
              {campaignRows.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-gray-400">Sem investimento no período.</td></tr>
              )}
            </tbody>
          </table>

          {pacing.length > 0 && (
            <div className="mt-5">
              <SectionTitle hint="Gasto médio por dia × orçamento diário (campanhas ativas)">Ritmo do orçamento</SectionTitle>
              <div className="space-y-2">
                {pacing.map((x) => (
                  <div key={x.id}>
                    <div className="flex justify-between gap-3 text-[10.5px]">
                      <span className="truncate font-semibold text-blue-900">{x.name}</span>
                      <span className="shrink-0 text-gray-600">
                        {brl(x.avg)}/dia · {(x.ratio * 100).toFixed(0)}% de {brl(x.budget)}
                      </span>
                    </div>
                    <div className="mt-0.5 h-2 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${Math.min(x.ratio, 1.3) / 1.3 * 100}%`, background: x.ratio > 1.1 ? BRAND.red : x.ratio < 0.6 ? BRAND.steel : BRAND.green }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[9px] text-gray-400">Verde: dentro do orçamento · azul: abaixo de 60% · vermelho: acima de 110%.</p>
            </div>
          )}
        </PageShell>

        {/* ── Página 3: anúncios e leads da LP ── */}
        <PageShell n={3} total={total} footer={footer}>
          <SectionTitle hint="Por leads no período (desempate pelo menor gasto)">Top 6 anúncios</SectionTitle>
          {topAds.length === 0 ? (
            <p className="mb-5 py-6 text-center text-[11px] text-gray-400">Nenhum anúncio com investimento no período.</p>
          ) : (
            <table className="mb-5 w-full text-[10.5px]">
              <thead>
                <tr className="text-left text-[9px] font-bold uppercase tracking-wide text-gray-500">
                  <th className="py-1" colSpan={2}>Anúncio</th>
                  <th className="py-1 text-right">Investido</th>
                  <th className="py-1 text-right">Leads</th>
                  <th className="py-1 text-right">CPL</th>
                  <th className="py-1 text-right">CTR</th>
                  <th className="py-1 text-right">Freq.</th>
                </tr>
              </thead>
              <tbody>
                {topAds.map(({ a, m }, i) => (
                  <tr key={a.id} className="border-t border-gray-100 align-middle">
                    <td className="w-[46px] py-1.5">
                      <div className="relative h-10 w-10 overflow-hidden rounded-md bg-gray-100">
                        {a.thumbnail_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.thumbnail_url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                        )}
                        <span className="absolute left-0 top-0 rounded-br-md bg-yellow-500 px-1 text-[9px] font-bold text-blue-900">{i + 1}</span>
                      </div>
                    </td>
                    <td className="max-w-[250px] py-1.5 pr-2 font-semibold leading-tight text-blue-900"><span className="line-clamp-2">{a.name}</span></td>
                    <td className="py-1.5 text-right">{brl(m.spend)}</td>
                    <td className="py-1.5 text-right font-bold text-blue-900">{fmt(m.leads)}</td>
                    <td className="py-1.5 text-right">{m.leads ? brl(cpl(m)) : "—"}</td>
                    <td className="py-1.5 text-right">{pct2(ctr(m))}</td>
                    <td className="py-1.5 text-right">{frequency(m).toFixed(2).replace(".", ",")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <SectionTitle hint="Recebidos pela LP, cruzados com anúncio/campanha pelas UTMs">Leads da landing page</SectionTitle>
          <div className="mb-3 grid grid-cols-3 gap-3">
            {[
              { label: "Leads recebidos na LP", value: fmt(lpCur.length), delta: hasPrevious ? <Delta cur={lpCur.length} prev={lpPrev.length} /> : null },
              { label: "CPL real (LP)", value: lpCur.length ? brl(lpCpl) : "—", delta: hasPrevious && prevLpCpl ? <Delta cur={lpCpl} prev={prevLpCpl} invert /> : null },
              { label: "Com anúncio identificado", value: percent(matched, lpCur.length, 0), delta: null },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-gray-200 bg-gray-050 p-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500">{k.label}</p>
                <p className="mt-0.5 font-display text-lg font-bold text-blue-900">{k.value}</p>
                <p className="min-h-[12px] text-[9px] text-gray-500">{k.delta}</p>
              </div>
            ))}
          </div>
          {lpCur.length === 0 ? (
            <p className="py-6 text-center text-[11px] text-gray-400">Nenhum lead da landing page neste período.</p>
          ) : (
            <div className="grid grid-cols-2 gap-5">
              <div>
                <p className="mb-1 text-[11px] font-bold text-blue-900">Leads por dia</p>
                {mounted && (
                  <BarChart width={330} height={150} data={lpByDay} margin={{ left: -24, right: 4, top: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                    <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
                    <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Bar dataKey="leads" fill={BRAND.green} isAnimationActive={false} radius={[3, 3, 0, 0]} />
                  </BarChart>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-[11px] font-bold text-blue-900">Por estado</p>
                  {lpStates.map(([label, value]) => (
                    <div key={label} className="flex justify-between text-[10.5px]">
                      <span className="font-semibold text-blue-900">{label}</span>
                      <span>{fmt(value)} · {percent(value, lpCur.length, 0)}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-bold text-blue-900">Por campanha</p>
                  {lpCampaigns.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 text-[10.5px]">
                      <span className="truncate font-semibold text-blue-900">{label}</span>
                      <span className="shrink-0">{fmt(value)} · {percent(value, lpCur.length, 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="absolute bottom-[18mm] left-[12mm] right-[12mm] rounded-lg bg-gray-050 p-3 text-[9px] leading-snug text-gray-500">
            <p className="mb-0.5 font-bold uppercase tracking-wide text-gray-600">Notas metodológicas</p>
            Fonte: Gerenciador de Anúncios da Meta (Marketing API), somente leitura; valores em reais. “Leads (Meta)” são as conversões de lead reportadas pelo
            Gerenciador; “Leads da LP” são os recebidos pela landing page e cruzados com o anúncio pelas UTMs. Cliques = cliques no link. Alcance e
            frequência usam a soma diária (a mesma pessoa pode contar em dias diferentes). Dias no fuso de São Paulo; o dia corrente é parcial e, quando
            incluído, não é comparado ao período anterior. Somente campanhas ativas na última sincronização.
            Relatório gerado em {new Date(generatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.
          </div>
        </PageShell>
      </div>
    </div>
  );
}
