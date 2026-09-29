"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { createClient } from "@/lib/supabase/client";
import {
  aggregateTraffic,
  countLeadsByAd,
  dailySeries,
  defaultDateRange,
  loadTrafficStructure,
  type DateRange,
  type LeadStats,
  type Metrics,
  type TrafficStructure,
} from "@/lib/services/meta-ads";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { currencyFormatter, formatDay, numberFormatter } from "@/lib/format";
import { TrafficBarChart, TrafficLineChart } from "@/components/ads/TrafficCharts";

// KPIs e gráficos do Tráfego Pago. Os filtros de campanha/conjunto/anúncio
// são em cascata (escolher uma campanha já restringe os conjuntos e
// anúncios disponíveis, igual ao Gerenciador da Meta) e reduzem tanto os
// KPIs quanto os dois gráficos ao nível escolhido:
//   - sem filtro: total geral + barras por campanha
//   - campanha escolhida: total da campanha + barras por conjunto dela
//   - conjunto escolhido: total do conjunto + barras por anúncio dele
//   - anúncio escolhido: total do anúncio (sem gráfico de barras — não há
//     nível abaixo; ainda mostra a evolução diária)
// O ranking de criativos vinculados é a única seção que usa dado vitalício
// (colunas impressions/clicks/spend/conversions de `creatives`, atualizadas
// pelo sync), por isso fica fora do filtro de data/entidade.

const EMPTY_STRUCTURE: TrafficStructure = { campaigns: [], adSets: [], ads: [], insights: [], minDate: null, maxDate: null };

function zero(): Metrics {
  return { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
}
function addUp(a: Metrics, b: Metrics): Metrics {
  return {
    spend: a.spend + b.spend,
    impressions: a.impressions + b.impressions,
    clicks: a.clicks + b.clicks,
    conversions: a.conversions + b.conversions,
  };
}
function ctrOf(m: Metrics) {
  return m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
}
function cpcOf(m: Metrics) {
  return m.clicks > 0 ? m.spend / m.clicks : 0;
}
function cpmOf(m: Metrics) {
  return m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0;
}
function cpaOf(m: Metrics) {
  return m.conversions > 0 ? m.spend / m.conversions : 0;
}
function convRateOf(m: Metrics) {
  return m.clicks > 0 ? (m.conversions / m.clicks) * 100 : 0;
}

interface CreativeStat {
  id: string;
  name: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
}

type LineMetricKey = "spend" | "impressions" | "clicks" | "conversions" | "ctr";

const LINE_METRIC_OPTIONS: { key: LineMetricKey; label: string }[] = [
  { key: "spend", label: "Investido" },
  { key: "impressions", label: "Impressões" },
  { key: "clicks", label: "Cliques no link" },
  { key: "conversions", label: "Conversões" },
  { key: "ctr", label: "CTR" },
];

function formatByMetric(key: LineMetricKey, value: number) {
  if (key === "spend") return currencyFormatter.format(value);
  if (key === "ctr") return `${value.toFixed(2)}%`;
  return numberFormatter.format(value);
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-blue-900">{value}</p>
    </Card>
  );
}

function RankBar({
  label,
  display,
  value,
  max,
  tone,
}: {
  label: string;
  display: string;
  value: number;
  max: number;
  tone: string;
}) {
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
        <span className="truncate font-semibold text-blue-900">{label}</span>
        <span className="shrink-0 tabular-nums text-gray-700">{display}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100">
        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: tone }} />
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase text-gray-500">{label}</p>
      {children}
    </div>
  );
}

export function TrafficDashboard() {
  const supabase = createClient();
  const [structure, setStructure] = useState<TrafficStructure>(EMPTY_STRUCTURE);
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange);
  const [topCreatives, setTopCreatives] = useState<CreativeStat[]>([]);
  const [leadStats, setLeadStats] = useState<LeadStats>({ topAds: [], unmatched: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  const [campaignId, setCampaignId] = useState("");
  const [adSetId, setAdSetId] = useState("");
  const [adId, setAdId] = useState("");
  const [lineMetric, setLineMetric] = useState<LineMetricKey>("spend");

  async function load() {
    const [structureResult, creativesResult] = await Promise.all([
      loadTrafficStructure(supabase),
      supabase
        .from("creatives")
        .select("id, name, impressions, clicks, spend, conversions")
        .gt("impressions", 0)
        .order("conversions", { ascending: false })
        .limit(5),
    ]);
    setStructure(structureResult);
    setTopCreatives((creativesResult.data ?? []) as CreativeStat[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeChanges(["meta_campaigns", "meta_ad_sets", "meta_ads", "meta_ad_insights", "creatives"], load);

  async function loadLeadStats() {
    const stats = await countLeadsByAd(supabase, dateRange);
    setLeadStats(stats);
  }

  useEffect(() => {
    loadLeadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  useRealtimeChanges(["landing_page_leads"], loadLeadStats);

  const data = useMemo(() => aggregateTraffic(structure, dateRange), [structure, dateRange]);

  const adSetOptions = useMemo(
    () => (campaignId ? data.adSets.filter((a) => a.campaign_id === campaignId) : data.adSets),
    [data.adSets, campaignId]
  );
  const adOptions = useMemo(() => {
    if (adSetId) return data.ads.filter((a) => a.adset_id === adSetId);
    if (campaignId) return data.ads.filter((a) => a.adset?.campaign?.id === campaignId);
    return data.ads;
  }, [data.ads, adSetId, campaignId]);

  function onCampaignChange(value: string) {
    setCampaignId(value);
    setAdSetId("");
    setAdId("");
  }
  function onAdSetChange(value: string) {
    setAdSetId(value);
    setAdId("");
  }

  const selectedAd = adId ? data.ads.find((a) => a.id === adId) ?? null : null;
  const selectedAdSet = adSetId ? data.adSets.find((a) => a.id === adSetId) ?? null : null;
  const selectedCampaign = campaignId ? data.campaigns.find((c) => c.id === campaignId) ?? null : null;

  const totals = useMemo(() => {
    if (selectedAd) return selectedAd.metrics;
    if (selectedAdSet) return selectedAdSet.metrics;
    if (selectedCampaign) return selectedCampaign.metrics;
    return data.campaigns.reduce((acc, c) => addUp(acc, c.metrics), zero());
  }, [selectedAd, selectedAdSet, selectedCampaign, data.campaigns]);

  const barChart = useMemo(() => {
    if (adId) return { title: "Anúncio selecionado", items: [] as { label: string; value: number }[] };
    if (adSetId) {
      const items = adOptions.map((a) => ({ label: a.name, value: a.metrics.spend }));
      return { title: "Investimento por anúncio", items: items.sort((a, b) => b.value - a.value).slice(0, 10) };
    }
    if (campaignId) {
      const items = adSetOptions.map((a) => ({ label: a.name, value: a.metrics.spend }));
      return { title: "Investimento por conjunto de anúncios", items: items.sort((a, b) => b.value - a.value).slice(0, 10) };
    }
    const items = data.campaigns.map((c) => ({ label: c.name, value: c.metrics.spend }));
    return { title: "Investimento por campanha", items: items.sort((a, b) => b.value - a.value).slice(0, 10) };
  }, [adId, adSetId, campaignId, adOptions, adSetOptions, data.campaigns]);

  const seriesAdIds = useMemo(() => {
    if (adId) return new Set([adId]);
    if (adSetId) return new Set(adOptions.map((a) => a.id));
    if (campaignId) return new Set(adOptions.map((a) => a.id));
    return null;
  }, [adId, adSetId, campaignId, adOptions]);

  const series = useMemo(() => dailySeries(structure, dateRange, seriesAdIds), [structure, dateRange, seriesAdIds]);
  const lineData = useMemo(
    () =>
      series.map((point) => ({
        label: formatDay(point.date),
        value: lineMetric === "ctr" ? ctrOf(point) : point[lineMetric],
      })),
    [series, lineMetric]
  );

  const topCampaigns = useMemo(
    () =>
      [...data.campaigns]
        .filter((c) => c.metrics.spend > 0)
        .sort((a, b) => b.metrics.spend - a.metrics.spend)
        .slice(0, 5),
    [data]
  );
  const maxCreativeConversions = topCreatives[0]?.conversions ?? 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <FilterField label="De">
          <input
            type="date"
            value={dateRange.since}
            max={dateRange.until}
            min={structure.minDate ?? undefined}
            onChange={(e) => setDateRange((r) => ({ ...r, since: e.target.value }))}
            className="h-9 rounded-[14px] border border-gray-200 bg-white px-2.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
          />
        </FilterField>
        <FilterField label="Até">
          <input
            type="date"
            value={dateRange.until}
            min={dateRange.since}
            max={structure.maxDate ?? undefined}
            onChange={(e) => setDateRange((r) => ({ ...r, until: e.target.value }))}
            className="h-9 rounded-[14px] border border-gray-200 bg-white px-2.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
          />
        </FilterField>
        <FilterField label="Campanha">
          <div className="w-56">
            <Select className="h-9" value={campaignId} onChange={(e) => onCampaignChange(e.target.value)}>
              <option value="">Todas</option>
              {data.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </FilterField>
        <FilterField label="Conjunto de anúncios">
          <div className="w-56">
            <Select className="h-9" value={adSetId} onChange={(e) => onAdSetChange(e.target.value)}>
              <option value="">Todos</option>
              {adSetOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        </FilterField>
        <FilterField label="Anúncio">
          <div className="w-56">
            <Select className="h-9" value={adId} onChange={(e) => setAdId(e.target.value)}>
              <option value="">Todos</option>
              {adOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        </FilterField>
        {structure.minDate && (
          <p className="pb-2 text-xs text-gray-400">Dados sincronizados desde {formatDay(structure.minDate)}.</p>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Investido" value={loading ? "—" : currencyFormatter.format(totals.spend)} />
        <KpiCard label="Impressões" value={loading ? "—" : numberFormatter.format(totals.impressions)} />
        <KpiCard label="Cliques no link" value={loading ? "—" : numberFormatter.format(totals.clicks)} />
        <KpiCard label="CTR" value={loading ? "—" : `${ctrOf(totals).toFixed(2)}%`} />
        <KpiCard label="Conversões" value={loading ? "—" : numberFormatter.format(totals.conversions)} />
        <KpiCard label="CPC" value={loading ? "—" : currencyFormatter.format(cpcOf(totals))} />
        <KpiCard label="CPM" value={loading ? "—" : currencyFormatter.format(cpmOf(totals))} />
        <KpiCard label="Custo por conversão" value={loading ? "—" : currencyFormatter.format(cpaOf(totals))} />
        <KpiCard label="Taxa de conversão" value={loading ? "—" : `${convRateOf(totals).toFixed(2)}%`} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{barChart.title}</CardTitle>
            <span className="text-xs text-gray-400">no período selecionado</span>
          </CardHeader>
          <CardBody>
            {barChart.items.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">
                {adId ? "Selecione um nível acima (campanha/conjunto) para ver a comparação em barras." : "Sem dados no período selecionado."}
              </p>
            ) : (
              <TrafficBarChart data={barChart.items} formatValue={(v) => currencyFormatter.format(v)} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="items-center">
            <CardTitle>Evolução diária</CardTitle>
            <div className="w-40">
              <Select className="h-8 text-xs" value={lineMetric} onChange={(e) => setLineMetric(e.target.value as LineMetricKey)}>
                {LINE_METRIC_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          </CardHeader>
          <CardBody>
            {lineData.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">Sem dados no período selecionado.</p>
            ) : (
              <TrafficLineChart data={lineData} formatValue={(v) => formatByMetric(lineMetric, v)} />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 5 campanhas por investimento</CardTitle>
            <span className="text-xs text-gray-400">no período selecionado</span>
          </CardHeader>
          <CardBody>
            {topCampaigns.length === 0 && (
              <p className="text-sm text-gray-400">
                {loading ? "Carregando..." : "Nenhum investimento no período selecionado."}
              </p>
            )}
            {topCampaigns.map((c) => (
              <RankBar
                key={c.id}
                label={c.name}
                display={currencyFormatter.format(c.metrics.spend)}
                value={c.metrics.spend}
                max={topCampaigns[0]?.metrics.spend ?? 0}
                tone="#fcbf00"
              />
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 criativos vinculados</CardTitle>
            <span className="text-xs text-gray-400">desempenho vitalício</span>
          </CardHeader>
          <CardBody>
            {topCreatives.length === 0 && (
              <p className="text-sm text-gray-400">
                {loading ? "Carregando..." : "Nenhum criativo com anúncio vinculado ainda."}
              </p>
            )}
            {topCreatives.map((c) => (
              <div key={c.id} className="mb-3">
                <RankBar
                  label={c.name}
                  display={`${numberFormatter.format(c.conversions)} conv.`}
                  value={c.conversions}
                  max={maxCreativeConversions}
                  tone="#2f9e44"
                />
                <p className="text-xs text-gray-400">
                  {currencyFormatter.format(c.spend)} · {numberFormatter.format(c.impressions)} impressões ·{" "}
                  {numberFormatter.format(c.clicks)} cliques
                </p>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Top 3 anúncios campeões (leads da LP)</CardTitle>
            <span className="text-xs text-gray-400">no período selecionado</span>
          </CardHeader>
          <CardBody>
            {leadStats.topAds.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum lead da landing page casado com anúncio nesse período.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                {leadStats.topAds.map((a, i) => (
                  <div key={a.adId} className="rounded-2xl border border-gray-200 p-4">
                    <span className="text-2xl">{["🥇", "🥈", "🥉"][i]}</span>
                    <p className="mt-1 truncate text-sm font-semibold text-blue-900" title={a.adName}>
                      {a.adName}
                    </p>
                    <p className="text-xs text-gray-500">{numberFormatter.format(a.count)} leads</p>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-gray-400">
              {numberFormatter.format(leadStats.total)} leads recebidos no período
              {leadStats.unmatched > 0 && (
                <> · {numberFormatter.format(leadStats.unmatched)} sem anúncio identificado pela UTM</>
              )}
              .
            </p>
          </CardBody>
        </Card>
      </div>

      {!loading && data.campaigns.length === 0 && (
        <div className="mt-6">
          <Badge tone="neutral">Nenhum dado sincronizado ainda — rode o sync do Gerenciador de Anúncios.</Badge>
        </div>
      )}
    </div>
  );
}
