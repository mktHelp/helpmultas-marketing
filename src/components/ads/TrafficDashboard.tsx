"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CalendarDays, Coins, Eye, Globe2, Megaphone, MousePointerClick, Percent, Repeat2, ScanEye,
  FileDown, Target, TrendingDown, Trophy, UserPlus, Wallet, X, Zap,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, XAxis, YAxis,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import {
  BRAND, BarList, Chip, ChartTooltip, Donut, GRID_COLOR, Insight, Kpi, Panel, RTooltip, TICK_STYLE, compact, fmt, percent,
  shortDate, tipDate,
} from "@/components/shared/dash-parts";
import { createClient } from "@/lib/supabase/client";
import { loadLandingLeads, loadTrafficStructure, type LandingLead as LpLead, type TrafficStructure } from "@/lib/services/meta-ads";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { currencyFormatter, numberFormatter } from "@/lib/format";
import {
  PERIOD_OPTIONS, periodLabel, rangeForPreset, rangeLength, shiftDate, todayBRT, type DateRange, type PeriodKey,
} from "@/lib/period";
import {
  buildTrafficHighlights, connectRate, cpc, cpl, cpm, ctr, dailyTM, frequency, groupTM, leadRate, METRIC_VALUE,
  rowsInRange, sumTM, weekdayStats, zeroTM, type MetricKey, type TM, type TrafficHighlightKey,
} from "@/lib/traffic-analytics";
import { cn } from "@/lib/utils";

// Dashboard do Tráfego Pago (somente leitura, dados do Gerenciador de Anúncios
// sincronizados em meta_*). Mesmo padrão da aba Instagram: seletor de período
// (Hoje/Ontem/7/14/30/60/Personalizado), comparação com o período anterior,
// KPIs com mini-gráfico e gráficos interativos. Os filtros de campanha →
// conjunto → anúncio são em cascata e valem pra tudo na tela.
//
// Leads: "Leads (Meta)" são as conversões reportadas pelo Gerenciador;
// "Leads da LP" são os recebidos pela landing page (landing_page_leads),
// que alimentam o custo por lead real e as quebras por estado e campanha.

const EMPTY_STRUCTURE: TrafficStructure = { campaigns: [], adSets: [], ads: [], insights: [], minDate: null, maxDate: null };

interface CreativeStat {
  id: string;
  name: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
}

const BRT_OFFSET_MS = 3 * 3600 * 1000;
const brtDay = (iso: string) => new Date(Date.parse(iso) - BRT_OFFSET_MS).toISOString().slice(0, 10);
const brl = (n: number) => currencyFormatter.format(n);
const pct2 = (n: number) => `${n.toFixed(2).replace(".", ",")}%`;

// ── Métricas exibíveis no gráfico principal ────────────────────────────────

type ChartKey = MetricKey | "spendLeads";

const CHART_METRICS: { key: ChartKey; label: string; color: string; money?: boolean; pct?: boolean; lowIsGood?: boolean }[] = [
  { key: "spend", label: "Investido", color: BRAND.blue, money: true },
  { key: "leads", label: "Leads", color: BRAND.green },
  { key: "cpl", label: "Custo por lead", color: BRAND.red, money: true, lowIsGood: true },
  { key: "spendLeads", label: "Investido × Leads", color: BRAND.yellow },
  { key: "impressions", label: "Impressões", color: BRAND.steel },
  { key: "reach", label: "Alcance", color: "#8b5fbf" },
  { key: "clicks", label: "Cliques no link", color: "#e07b39" },
  { key: "ctr", label: "CTR", color: "#2a9d8f", pct: true },
  { key: "cpc", label: "CPC", color: "#c77dba", money: true, lowIsGood: true },
  { key: "cpm", label: "CPM", color: "#6b7a86", money: true, lowIsGood: true },
];

function formatMetric(key: ChartKey, value: number) {
  const def = CHART_METRICS.find((m) => m.key === key);
  if (def?.money) return brl(value);
  if (def?.pct) return pct2(value);
  return numberFormatter.format(Math.round(value));
}

// ── Tabela por nível ───────────────────────────────────────────────────────

type Level = "campaign" | "adset" | "ad";
type SortKey = "name" | "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "leads" | "cpl" | "frequency";

interface TableRow {
  id: string;
  name: string;
  sub?: string;
  active?: boolean;
  budget?: number | null;
  m: TM;
}

function sortValue(row: TableRow, key: SortKey): number | string {
  switch (key) {
    case "name": return row.name.toLowerCase();
    case "spend": return row.m.spend;
    case "impressions": return row.m.impressions;
    case "clicks": return row.m.clicks;
    case "ctr": return ctr(row.m);
    case "cpc": return cpc(row.m);
    case "leads": return row.m.leads;
    case "cpl": return cpl(row.m);
    case "frequency": return frequency(row.m);
  }
}

const HIGHLIGHT_ICONS: Record<TrafficHighlightKey, typeof Trophy> = {
  bestCpl: Trophy,
  wasted: AlertTriangle,
  frequency: Repeat2,
  cplTrend: TrendingDown,
  weekday: CalendarDays,
  funnel: Globe2,
  bestCampaign: Megaphone,
};

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

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase text-gray-500">{label}</p>
      {children}
    </div>
  );
}

function FunnelStep({ label, value, width, rate, rateLabel, color }: { label: string; value: number; width: number; rate?: number; rateLabel?: string; color: string }) {
  return (
    <div>
      {rateLabel && (
        <p className="mb-1 ml-28 pl-3 text-[11px] font-semibold text-gray-500">
          ↓ {rateLabel}: <span className="text-blue-900">{rate != null ? pct2(rate) : "—"}</span>
        </p>
      )}
      <div className="flex items-center gap-3">
        <span className="w-28 shrink-0 text-xs font-bold text-blue-900">{label}</span>
        <div className="h-8 flex-1 rounded-lg bg-gray-100">
          <div className="h-8 rounded-lg transition-all" style={{ width: `${Math.max(width, 2)}%`, background: color }} />
        </div>
        <span className="w-24 text-right font-display text-lg font-bold text-blue-900">{fmt(value)}</span>
      </div>
    </div>
  );
}

export function TrafficDashboard() {
  const supabase = createClient();
  const today = useMemo(() => todayBRT(), []);
  const [structure, setStructure] = useState<TrafficStructure>(EMPTY_STRUCTURE);
  const [topCreatives, setTopCreatives] = useState<CreativeStat[]>([]);
  const [lpLeads, setLpLeads] = useState<LpLead[]>([]);
  const [prevLpLeads, setPrevLpLeads] = useState<LpLead[]>([]);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod] = useState<PeriodKey>("30");
  const [custom, setCustom] = useState<DateRange>(() => ({ from: shiftDate(todayBRT(), -7), to: shiftDate(todayBRT(), -1) }));
  const [campaignId, setCampaignId] = useState("");
  const [adSetId, setAdSetId] = useState("");
  const [adId, setAdId] = useState("");
  const [chartKey, setChartKey] = useState<ChartKey>("spend");
  const [level, setLevel] = useState<Level>("campaign");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "spend", dir: "desc" });
  const [tableLimit, setTableLimit] = useState(12);
  const [adSort, setAdSort] = useState<"leads" | "cpl" | "ctr" | "spend">("leads");
  const [adLimit, setAdLimit] = useState(8);
  const [preview, setPreview] = useState<{ adName: string; url: string | null; loading: boolean; error: string | null } | null>(null);

  // Preview visual do anúncio (iframe oficial da Meta, via /api/meta-ads/preview).
  async function openPreview(adName: string, metaAdId: string) {
    setPreview({ adName, url: null, loading: true, error: null });
    try {
      const res = await fetch(`/api/meta-ads/preview?metaAdId=${encodeURIComponent(metaAdId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao gerar preview");
      setPreview({ adName, url: json.previewUrl, loading: false, error: null });
    } catch (err) {
      setPreview({ adName, url: null, loading: false, error: err instanceof Error ? err.message : "Erro desconhecido" });
    }
  }

  const range = useMemo(() => rangeForPreset(period, custom, today), [period, custom, today]);
  const length = rangeLength(range);
  const prevRange = useMemo(() => ({ from: shiftDate(range.from, -length), to: shiftDate(range.from, -1) }), [range, length]);

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

  async function loadLeads() {
    try {
      const [cur, prev] = await Promise.all([
        loadLandingLeads(supabase, range.from, range.to),
        loadLandingLeads(supabase, prevRange.from, prevRange.to),
      ]);
      setLpLeads(cur);
      setPrevLpLeads(prev);
    } catch {
      setLpLeads([]);
      setPrevLpLeads([]);
    }
  }
  useEffect(() => {
    loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);
  useRealtimeChanges(["landing_page_leads"], loadLeads);

  // ── Estrutura e filtros em cascata ──
  const adSetById = useMemo(() => new Map(structure.adSets.map((a) => [a.id, a])), [structure.adSets]);
  const campaignById = useMemo(() => new Map(structure.campaigns.map((c) => [c.id, c])), [structure.campaigns]);
  const adById = useMemo(() => new Map(structure.ads.map((a) => [a.id, a])), [structure.ads]);
  const campaignOfAd = (id: string) => {
    const ad = adById.get(id);
    return ad ? (adSetById.get(ad.adset_id)?.campaign_id ?? null) : null;
  };

  const adSetOptions = useMemo(
    () => (campaignId ? structure.adSets.filter((a) => a.campaign_id === campaignId) : structure.adSets),
    [structure.adSets, campaignId]
  );
  const adOptions = useMemo(() => {
    if (adSetId) return structure.ads.filter((a) => a.adset_id === adSetId);
    if (campaignId) return structure.ads.filter((a) => adSetById.get(a.adset_id)?.campaign_id === campaignId);
    return structure.ads;
  }, [structure.ads, adSetId, campaignId, adSetById]);

  const adIds = useMemo(() => {
    if (adId) return new Set([adId]);
    if (adSetId || campaignId) return new Set(adOptions.map((a) => a.id));
    return null;
  }, [adId, adSetId, campaignId, adOptions]);

  function pickCampaign(id: string) {
    setCampaignId(id);
    setAdSetId("");
    setAdId("");
  }
  function pickAdSet(id: string) {
    setAdSetId(id);
    setAdId("");
  }
  function clearFilters() {
    pickCampaign("");
    setLevel("campaign");
  }

  // ── Agregações do período ──
  const curRows = useMemo(() => rowsInRange(structure.insights, range, adIds), [structure.insights, range, adIds]);
  const prevRows = useMemo(() => rowsInRange(structure.insights, prevRange, adIds), [structure.insights, prevRange, adIds]);
  const totals = useMemo(() => sumTM(curRows), [curRows]);
  const prevTotals = useMemo(() => sumTM(prevRows), [prevRows]);
  // Comparar só se o período anterior está coberto pelo histórico sincronizado
  // e o período atual já fechou (hoje é parcial).
  const hasPrevious = range.to < today && !!structure.minDate && structure.minDate <= prevRange.from && prevRows.length > 0;
  const prev = <T extends number>(v: T) => (hasPrevious ? v : null);

  const daily = useMemo(() => dailyTM(curRows, range), [curRows, range]);
  const weekday = useMemo(() => weekdayStats(daily), [daily]);

  const adTM = useMemo(() => groupTM(curRows, (id) => id), [curRows]);
  const adSetTM = useMemo(() => groupTM(curRows, (id) => adById.get(id)?.adset_id ?? null), [curRows, adById]);
  const campaignTM = useMemo(() => groupTM(curRows, (id) => campaignOfAd(id)), [curRows, adById, adSetById]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Gráfico principal ──
  const chartDef = CHART_METRICS.find((m) => m.key === chartKey) ?? CHART_METRICS[0];
  const chartData = useMemo(
    () =>
      daily.map((d) => ({
        date: d.date,
        label: shortDate(d.date),
        tip: tipDate(d.date),
        value: chartKey === "spendLeads" ? d.spend : METRIC_VALUE[chartKey](d),
        spend: d.spend,
        leads: d.leads,
      })),
    [daily, chartKey]
  );
  const chartAverage = chartKey === "spendLeads" ? totals.spend / Math.max(length, 1) : METRIC_VALUE[chartKey](totals);
  const extremeDay = useMemo(() => {
    const valid = chartData.filter((d) => d.value > 0);
    if (!valid.length) return null;
    return valid.reduce((m, d) => ((chartDef.lowIsGood ? d.value < m.value : d.value > m.value) ? d : m));
  }, [chartData, chartDef.lowIsGood]);

  // ── Tabela por nível ──
  const tableRows = useMemo<TableRow[]>(() => {
    const rows: TableRow[] =
      level === "campaign"
        ? structure.campaigns
            .filter((c) => !campaignId || c.id === campaignId)
            .map((c) => ({ id: c.id, name: c.name, active: c.active_in_meta, budget: c.daily_budget, m: campaignTM.get(c.id) ?? zeroTM() }))
        : level === "adset"
          ? adSetOptions.map((a) => ({
              id: a.id,
              name: a.name,
              sub: campaignById.get(a.campaign_id)?.name,
              budget: a.daily_budget,
              m: adSetTM.get(a.id) ?? zeroTM(),
            }))
          : adOptions.map((a) => ({
              id: a.id,
              name: a.name,
              sub: adSetById.get(a.adset_id)?.name,
              active: a.effective_status === "ACTIVE",
              m: adTM.get(a.id) ?? zeroTM(),
            }));
    const visible = rows.filter((r) => r.m.spend > 0 || r.m.impressions > 0);
    const dir = sort.dir === "asc" ? 1 : -1;
    return visible.sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      // CPL 0 = sem lead: vai pro fim em qualquer direção.
      if (sort.key === "cpl") {
        if (va === 0 && vb !== 0) return 1;
        if (vb === 0 && va !== 0) return -1;
      }
      if (typeof va === "string") return dir * va.localeCompare(vb as string);
      return dir * ((va as number) - (vb as number));
    });
  }, [level, structure.campaigns, campaignId, campaignTM, adSetOptions, adSetTM, adOptions, adTM, campaignById, adSetById, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "cpl" || key === "cpc" ? "asc" : "desc" }));
  }
  function drill(row: TableRow) {
    if (level === "campaign") {
      pickCampaign(row.id);
      setLevel("adset");
    } else if (level === "adset") {
      const ad = adSetById.get(row.id);
      if (ad) setCampaignId(ad.campaign_id);
      pickAdSet(row.id);
      setLevel("ad");
    } else {
      setAdId(row.id);
    }
  }

  // ── Galeria de anúncios ──
  const gallery = useMemo(() => {
    const items = adOptions
      .map((a) => ({ ad: a, m: adTM.get(a.id) ?? zeroTM() }))
      .filter((x) => x.m.spend > 0);
    const by = {
      leads: (x: (typeof items)[number]) => -x.m.leads,
      cpl: (x: (typeof items)[number]) => (x.m.leads > 0 ? cpl(x.m) : Number.POSITIVE_INFINITY),
      ctr: (x: (typeof items)[number]) => -ctr(x.m),
      spend: (x: (typeof items)[number]) => -x.m.spend,
    }[adSort];
    return items.sort((a, b) => by(a) - by(b));
  }, [adOptions, adTM, adSort]);

  // ── Destaques ──
  const highlights = useMemo(
    () =>
      buildTrafficHighlights({
        totals,
        previous: hasPrevious ? prevTotals : null,
        ads: adOptions.map((a) => ({ id: a.id, name: a.name, m: adTM.get(a.id) ?? zeroTM() })),
        campaigns: structure.campaigns.map((c) => ({ id: c.id, name: c.name, m: campaignTM.get(c.id) ?? zeroTM() })),
        weekday,
      }),
    [totals, prevTotals, hasPrevious, adOptions, adTM, structure.campaigns, campaignTM, weekday]
  );

  // ── Leads da LP ──
  const lpScope = (l: LpLead) => {
    if (adId) return l.matched_ad_id === adId;
    if (adSetId) return l.matched_adset_id === adSetId;
    if (campaignId) return l.matched_campaign_id === campaignId;
    return true;
  };
  const lpCur = useMemo(() => lpLeads.filter(lpScope), [lpLeads, campaignId, adSetId, adId]); // eslint-disable-line react-hooks/exhaustive-deps
  const lpPrev = useMemo(() => prevLpLeads.filter(lpScope), [prevLpLeads, campaignId, adSetId, adId]); // eslint-disable-line react-hooks/exhaustive-deps
  const lpByDay = useMemo(() => {
    const counts = new Map<string, number>();
    lpCur.forEach((l) => counts.set(brtDay(l.received_at), (counts.get(brtDay(l.received_at)) ?? 0) + 1));
    const out: { date: string; label: string; tip: string; leads: number }[] = [];
    for (let d = range.from; d <= range.to; d = shiftDate(d, 1)) out.push({ date: d, label: shortDate(d), tip: tipDate(d), leads: counts.get(d) ?? 0 });
    return out;
  }, [lpCur, range]);
  const lpStates = useMemo(() => {
    const m = new Map<string, number>();
    lpCur.forEach((l) => {
      const k = l.state?.trim().toUpperCase() || "Não informado";
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [lpCur]);
  const lpCampaigns = useMemo(() => {
    const m = new Map<string, number>();
    lpCur.forEach((l) => {
      const k = l.matched_campaign_id ? (campaignById.get(l.matched_campaign_id)?.name ?? "Campanha removida") : "Sem campanha identificada";
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [lpCur, campaignById]);
  const lpCpl = lpCur.length > 0 ? totals.spend / lpCur.length : 0;
  const prevLpCpl = lpPrev.length > 0 && prevTotals.spend > 0 ? prevTotals.spend / lpPrev.length : 0;

  // ── Ritmo de orçamento (campanhas com orçamento diário) ──
  const pacing = useMemo(
    () =>
      structure.campaigns
        .filter((c) => c.active_in_meta && c.daily_budget && c.daily_budget > 0 && (campaignTM.get(c.id)?.spend ?? 0) > 0)
        .map((c) => {
          const avgDaily = (campaignTM.get(c.id)?.spend ?? 0) / Math.max(length, 1);
          return { label: c.name, value: avgDaily, ratio: avgDaily / (c.daily_budget as number), budget: c.daily_budget as number };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 6),
    [structure.campaigns, campaignTM, length]
  );

  // ── Distribuição do investimento por campanha ──
  const spendSlices = useMemo(() => {
    const palette = [BRAND.blue, BRAND.yellow, BRAND.steel, BRAND.green, "#8b5fbf", "#e07b39"];
    const list = structure.campaigns
      .map((c) => ({ name: c.name, value: campaignTM.get(c.id)?.spend ?? 0 }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value);
    const top = list.slice(0, 6).map((c, i) => ({ ...c, color: palette[i % palette.length] }));
    const rest = list.slice(6).reduce((s, c) => s + c.value, 0);
    return rest > 0 ? [...top, { name: "Outras", value: rest, color: "#9aa7af" }] : top;
  }, [structure.campaigns, campaignTM]);

  // ── KPIs ──
  const spark = (key: MetricKey) => daily.map((d) => METRIC_VALUE[key](d));
  const kpis: {
    label: string;
    value: string;
    cur: number;
    prev: number | null;
    icon: typeof Eye;
    metric?: MetricKey;
    color: string;
    invert?: boolean;
    hint?: string;
  }[] = [
    { label: "Investido", value: brl(totals.spend), cur: totals.spend, prev: prev(prevTotals.spend), icon: Wallet, metric: "spend", color: BRAND.blue },
    { label: "Leads (Meta)", value: fmt(totals.leads), cur: totals.leads, prev: prev(prevTotals.leads), icon: UserPlus, metric: "leads", color: BRAND.green },
    { label: "Custo por lead", value: totals.leads ? brl(cpl(totals)) : "—", cur: cpl(totals), prev: prev(cpl(prevTotals)), icon: Target, metric: "cpl", color: BRAND.red, invert: true },
    { label: "Impressões", value: fmt(totals.impressions), cur: totals.impressions, prev: prev(prevTotals.impressions), icon: Eye, metric: "impressions", color: BRAND.steel },
    { label: "Alcance", value: fmt(totals.reach), cur: totals.reach, prev: prev(prevTotals.reach), icon: ScanEye, metric: "reach", color: "#8b5fbf", hint: "Soma diária" },
    { label: "Cliques no link", value: fmt(totals.clicks), cur: totals.clicks, prev: prev(prevTotals.clicks), icon: MousePointerClick, metric: "clicks", color: "#e07b39" },
    { label: "CTR", value: pct2(ctr(totals)), cur: ctr(totals), prev: prev(ctr(prevTotals)), icon: Percent, metric: "ctr", color: "#2a9d8f" },
    { label: "CPC", value: totals.clicks ? brl(cpc(totals)) : "—", cur: cpc(totals), prev: prev(cpc(prevTotals)), icon: Coins, metric: "cpc", color: "#c77dba", invert: true },
    { label: "CPM", value: totals.impressions ? brl(cpm(totals)) : "—", cur: cpm(totals), prev: prev(cpm(prevTotals)), icon: Coins, metric: "cpm", color: "#6b7a86", invert: true },
    { label: "Frequência", value: frequency(totals).toFixed(2).replace(".", ","), cur: frequency(totals), prev: prev(frequency(prevTotals)), icon: Repeat2, color: BRAND.steel, invert: true, hint: "Impressões ÷ alcance" },
    { label: "Visitas à LP", value: fmt(totals.lpViews), cur: totals.lpViews, prev: prev(prevTotals.lpViews), icon: Globe2, color: "#2a9d8f", hint: `${pct2(connectRate(totals))} dos cliques` },
    { label: "Conversão da LP", value: pct2(leadRate(totals)), cur: leadRate(totals), prev: prev(leadRate(prevTotals)), icon: Zap, color: BRAND.green, hint: "Leads ÷ visitas" },
  ];

  const hasData = structure.campaigns.length > 0;
  const label = periodLabel(period, range);
  const maxFunnel = Math.max(totals.impressions, 1);
  const funnelWidth = (v: number) => (Math.sqrt(v) / Math.sqrt(maxFunnel)) * 100;
  const hasFilter = !!(campaignId || adSetId || adId);

  const levelTabs = [
    { key: "campaign", label: "Campanhas" },
    { key: "adset", label: "Conjuntos" },
    { key: "ad", label: "Anúncios" },
  ];
  const cols: { key: SortKey; label: string; align?: "right" }[] = [
    { key: "spend", label: "Investido", align: "right" },
    { key: "impressions", label: "Impr.", align: "right" },
    { key: "clicks", label: "Cliques", align: "right" },
    { key: "ctr", label: "CTR", align: "right" },
    { key: "cpc", label: "CPC", align: "right" },
    { key: "leads", label: "Leads", align: "right" },
    { key: "cpl", label: "CPL", align: "right" },
    { key: "frequency", label: "Freq.", align: "right" },
  ];
  const maxSpend = Math.max(...tableRows.map((r) => r.m.spend), 1);

  return (
    <div className="space-y-5">
      {/* Controles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 max-w-full overflow-x-auto">
          <Tabs tabs={PERIOD_OPTIONS} active={period} onChange={(k) => setPeriod(k as PeriodKey)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
        {period === "custom" && (
          <div className="flex items-center gap-2">
            <DateField label="De" value={custom.from} min={structure.minDate ?? undefined} max={today} onChange={(v) => setCustom((c) => ({ ...c, from: v }))} />
            <DateField label="Até" value={custom.to} min={structure.minDate ?? undefined} max={today} onChange={(v) => setCustom((c) => ({ ...c, to: v }))} />
          </div>
        )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              window.open(
                `/relatorio/trafego?period=${period}&from=${range.from}&to=${range.to}&campaign=${campaignId}&print=1`,
                "_blank"
              )
            }
            disabled={!hasData}
          >
            <FileDown className="h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <FilterField label="Campanha">
          <div className="w-60">
            <Select className="h-9" value={campaignId} onChange={(e) => pickCampaign(e.target.value)}>
              <option value="">Todas</option>
              {structure.campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
        </FilterField>
        <FilterField label="Conjunto de anúncios">
          <div className="w-60">
            <Select className="h-9" value={adSetId} onChange={(e) => pickAdSet(e.target.value)}>
              <option value="">Todos</option>
              {adSetOptions.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </div>
        </FilterField>
        <FilterField label="Anúncio">
          <div className="w-60">
            <Select className="h-9" value={adId} onChange={(e) => setAdId(e.target.value)}>
              <option value="">Todos</option>
              {adOptions.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </div>
        </FilterField>
        {hasFilter && (
          <button onClick={clearFilters} className="mb-1 flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-blue-900 hover:border-blue-900">
            <X className="h-3.5 w-3.5" />
            Limpar filtros
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        <span className="font-semibold text-blue-900">
          {label}
          {period !== "custom" && length > 1 ? ` · ${shortDate(range.from)} a ${shortDate(range.to)}` : ""}
        </span>
        {range.to === today && " · o dia de hoje é parcial (sem comparação com período anterior)"}
        {structure.minDate && range.from < structure.minDate && ` · dados disponíveis a partir de ${shortDate(structure.minDate)}/${structure.minDate.slice(0, 4)}`}
        {hasPrevious && ` · comparado a ${shortDate(prevRange.from)}${length > 1 ? ` – ${shortDate(prevRange.to)}` : ""}`}
      </p>

      {!loading && !hasData && <Badge tone="neutral">Nenhum dado sincronizado ainda — rode o sync do Gerenciador de Anúncios.</Badge>}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Kpi
            key={k.label}
            label={k.label}
            icon={k.icon}
            value={loading ? "—" : k.value}
            current={k.cur}
            previous={k.prev}
            hint={k.hint}
            invert={k.invert}
            color={k.color}
            spark={k.metric ? spark(k.metric) : undefined}
            active={!!k.metric && chartKey === k.metric}
            onClick={k.metric ? () => setChartKey(k.metric as ChartKey) : undefined}
          />
        ))}
      </div>

      {/* Gráfico principal */}
      <Panel
        title="Desempenho por dia"
        subtitle={
          <>
            {chartKey === "spendLeads" ? "Média investida" : "Média do período"}: <b>{formatMetric(chartKey === "spendLeads" ? "spend" : chartKey, chartAverage)}</b>
            {extremeDay && (
              <>
                {" "}· {chartDef.lowIsGood ? "menor custo" : "pico"} <b>{extremeDay.tip}</b> ({formatMetric(chartKey === "spendLeads" ? "spend" : chartKey, extremeDay.value)})
              </>
            )}
          </>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {CHART_METRICS.map((m) => (
            <Chip key={m.key} active={chartKey === m.key} color={m.color} onClick={() => setChartKey(m.key)}>
              {m.label}
            </Chip>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          {chartKey === "spendLeads" ? (
            <ComposedChart data={chartData} margin={{ left: -6, right: -6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis yAxisId="l" tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
              <YAxis yAxisId="r" orientation="right" tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
              <RTooltip content={<ChartTooltip format={(n) => (Number.isInteger(n) ? numberFormatter.format(n) : brl(n))} />} cursor={{ fill: "#f4f6f8" }} />
              <Bar isAnimationActive={false} yAxisId="l" dataKey="spend" name="Investido" fill={BRAND.blue} radius={[4, 4, 0, 0]} />
              <Line isAnimationActive={false} yAxisId="r" type="monotone" dataKey="leads" name="Leads" stroke={BRAND.yellow} strokeWidth={2.5} dot={{ r: 3, fill: BRAND.yellow }} />
            </ComposedChart>
          ) : (
            <AreaChart data={chartData} margin={{ left: -6, right: 8 }}>
              <defs>
                <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartDef.color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={chartDef.color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
              <RTooltip content={<ChartTooltip format={(n) => formatMetric(chartKey, n)} />} />
              {chartAverage > 0 && <ReferenceLine y={chartAverage} stroke="#9aa7af" strokeDasharray="4 4" />}
              <Area isAnimationActive={false} type="monotone" dataKey="value" name={chartDef.label} stroke={chartDef.color} strokeWidth={2.5} fill="url(#trafficFill)" dot={{ r: 2.5, fill: chartDef.color }} activeDot={{ r: 5 }} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </Panel>

      {/* Funil + investimento */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Funil de conversão" subtitle="Do anúncio ao lead no período">
          <div className="space-y-2.5">
            <FunnelStep label="Impressões" value={totals.impressions} width={100} color={BRAND.blue} />
            <FunnelStep label="Cliques no link" value={totals.clicks} width={funnelWidth(totals.clicks)} rate={ctr(totals)} rateLabel="CTR" color={BRAND.steel} />
            <FunnelStep label="Visitas à LP" value={totals.lpViews} width={funnelWidth(totals.lpViews)} rate={connectRate(totals)} rateLabel="Conexão (visita ÷ clique)" color="#2a9d8f" />
            <FunnelStep label="Leads" value={totals.leads} width={funnelWidth(totals.leads)} rate={leadRate(totals)} rateLabel="Conversão da LP" color={BRAND.green} />
          </div>
          <p className="mt-3 text-[11px] text-gray-400">Larguras em escala de raiz quadrada para os últimos degraus continuarem visíveis.</p>
        </Panel>
        <Panel title="Onde o dinheiro está indo" subtitle="Distribuição do investimento por campanha">
          <Donut data={spendSlices} centerLabel="investido" centerValue={compact(totals.spend)} format={brl} />
        </Panel>
      </div>

      {/* Tabela por nível */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-[17px] font-semibold text-blue-900">Detalhamento</h3>
            <p className="mt-0.5 text-xs text-gray-500">Clique em uma linha para aprofundar (campanha → conjunto → anúncio)</p>
          </div>
          <Tabs tabs={levelTabs} active={level} onChange={(k) => { setLevel(k as Level); setTableLimit(12); }} />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                <th className="cursor-pointer py-2" onClick={() => toggleSort("name")}>
                  Nome {sort.key === "name" && (sort.dir === "asc" ? "↑" : "↓")}
                </th>
                {cols.map((c) => (
                  <th key={c.key} className="cursor-pointer py-2 text-right" onClick={() => toggleSort(c.key)}>
                    {c.label} {sort.key === c.key && (sort.dir === "asc" ? "↑" : "↓")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.slice(0, tableLimit).map((r) => (
                <tr key={r.id} onClick={() => drill(r)} className="cursor-pointer border-t border-gray-100 hover:bg-gray-050">
                  <td className="max-w-[320px] py-2.5 pr-3">
                    <p className="flex items-center gap-2 truncate font-semibold text-blue-900" title={r.name}>
                      {r.active != null && <span className={cn("h-2 w-2 shrink-0 rounded-full", r.active ? "bg-[color:var(--color-success)]" : "bg-gray-300")} title={r.active ? "Ativo" : "Inativo"} />}
                      <span className="truncate">{r.name}</span>
                      {level === "ad" && (
                        <button
                          type="button"
                          title="Ver preview do anúncio"
                          aria-label="Ver preview do anúncio"
                          onClick={(e) => {
                            e.stopPropagation();
                            const ad = adById.get(r.id);
                            if (ad) openPreview(ad.name, ad.meta_ad_id);
                          }}
                          className="ml-auto shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-900"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                    </p>
                    {(r.sub || r.budget) && (
                      <p className="truncate text-[11px] text-gray-400">
                        {r.sub}
                        {r.sub && r.budget ? " · " : ""}
                        {r.budget ? `orçamento ${brl(r.budget)}/dia` : ""}
                      </p>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="font-semibold text-blue-900">{brl(r.m.spend)}</span>
                    <div className="ml-auto mt-1 h-1 w-20 rounded-full bg-gray-100">
                      <div className="h-1 rounded-full bg-yellow-500" style={{ width: `${(r.m.spend / maxSpend) * 100}%` }} />
                    </div>
                  </td>
                  <td className="py-2.5 text-right">{fmt(r.m.impressions)}</td>
                  <td className="py-2.5 text-right">{fmt(r.m.clicks)}</td>
                  <td className="py-2.5 text-right">{pct2(ctr(r.m))}</td>
                  <td className="py-2.5 text-right">{r.m.clicks ? brl(cpc(r.m)) : "—"}</td>
                  <td className="py-2.5 text-right font-semibold text-blue-900">{fmt(r.m.leads)}</td>
                  <td className="py-2.5 text-right">{r.m.leads ? brl(cpl(r.m)) : "—"}</td>
                  <td className={cn("py-2.5 text-right", frequency(r.m) > 3 && "font-bold text-[color:var(--color-danger)]")}>
                    {frequency(r.m) ? frequency(r.m).toFixed(2).replace(".", ",") : "—"}
                  </td>
                </tr>
              ))}
              {tableRows.length === 0 && (
                <tr>
                  <td colSpan={cols.length + 1} className="py-8 text-center text-sm text-gray-400">Sem dados neste período.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {tableRows.length > tableLimit && (
          <div className="mt-3 flex justify-center">
            <button onClick={() => setTableLimit((n) => n + 12)} className="rounded-full border border-blue-900 px-4 py-1.5 text-xs font-semibold text-blue-900 hover:bg-blue-900 hover:text-white">
              Ver mais ({tableRows.length - tableLimit})
            </button>
          </div>
        )}
      </Card>

      {/* Galeria de anúncios */}
      <Panel
        title="Anúncios em destaque"
        subtitle="Somente anúncios com investimento no período"
        action={
          <div className="flex flex-wrap gap-2">
            {([["leads", "Mais leads"], ["cpl", "Menor CPL"], ["ctr", "Maior CTR"], ["spend", "Mais investido"]] as const).map(([k, l]) => (
              <Chip key={k} active={adSort === k} onClick={() => setAdSort(k)}>{l}</Chip>
            ))}
          </div>
        }
      >
        {gallery.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Nenhum anúncio com investimento neste período.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {gallery.slice(0, adLimit).map(({ ad, m }, i) => (
              <div key={ad.id} className="group overflow-hidden rounded-2xl border border-gray-200 transition-shadow hover:shadow-[var(--shadow-md)]">
                <button type="button" onClick={() => openPreview(ad.name, ad.meta_ad_id)} title="Ver preview do anúncio" className="block w-full cursor-pointer text-left">
                  <div className="relative aspect-[4/3] bg-gray-100">
                    {ad.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ad.thumbnail_url} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-gray-300">Sem prévia</div>
                    )}
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-blue-900/80 py-1.5 text-[11px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <Eye className="h-3.5 w-3.5" /> Ver preview
                    </span>
                    {i < 3 && adSort !== "spend" && (
                      <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 text-xs font-bold text-blue-900 shadow">{i + 1}</span>
                    )}
                    {m.leads === 0 && m.spend >= 50 && (
                      <span className="absolute right-2 top-2 rounded-full bg-[color:var(--color-danger)] px-2 py-0.5 text-[10px] font-bold text-white">Sem leads</span>
                    )}
                    {frequency(m) > 3 && (
                      <span className="absolute bottom-2 right-2 rounded-full bg-blue-900/90 px-2 py-0.5 text-[10px] font-bold text-white">Freq. {frequency(m).toFixed(1).replace(".", ",")}</span>
                    )}
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="line-clamp-2 min-h-[2.25rem] text-xs font-semibold leading-snug text-blue-900" title={ad.name}>{ad.name}</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="font-display text-sm font-bold text-blue-900">{brl(m.spend)}</p>
                        <p className="text-[9px] font-semibold uppercase text-gray-400">Investido</p>
                      </div>
                      <div>
                        <p className="font-display text-sm font-bold text-blue-900">{fmt(m.leads)}</p>
                        <p className="text-[9px] font-semibold uppercase text-gray-400">Leads</p>
                      </div>
                      <div>
                        <p className="font-display text-sm font-bold text-blue-900">{m.leads ? brl(cpl(m)) : "—"}</p>
                        <p className="text-[9px] font-semibold uppercase text-gray-400">CPL</p>
                      </div>
                    </div>
                    <p className="border-t border-gray-100 pt-2 text-center text-[11px] text-gray-500">
                      CTR {pct2(ctr(m))} · {fmt(m.impressions)} impr.
                    </p>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
        {gallery.length > adLimit && (
          <div className="mt-4 flex justify-center">
            <button onClick={() => setAdLimit((n) => n + 8)} className="rounded-full border border-blue-900 px-4 py-1.5 text-xs font-semibold text-blue-900 hover:bg-blue-900 hover:text-white">
              Ver mais ({gallery.length - adLimit})
            </button>
          </div>
        )}
      </Panel>

      {/* Dia da semana + ritmo */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Desempenho por dia da semana" subtitle="Média de investimento (barras) e de leads (linha) nos dias com gasto">
          <ResponsiveContainer width="100%" height={250}>
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
        <Panel title="Ritmo do orçamento" subtitle="Gasto médio por dia × orçamento diário das campanhas ativas">
          {pacing.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Nenhuma campanha com orçamento diário e gasto no período.</p>
          ) : (
            <BarList
              items={pacing.map((p) => ({
                label: p.label,
                value: p.value,
                hint: `${(p.ratio * 100).toFixed(0)}% de ${brl(p.budget)}`,
                color: p.ratio > 1.1 ? BRAND.red : p.ratio < 0.6 ? BRAND.steel : BRAND.green,
              }))}
              format={brl}
            />
          )}
          <p className="mt-3 text-[11px] text-gray-400">Verde: dentro do orçamento · azul: abaixo de 60% (subentregando) · vermelho: acima de 110%.</p>
        </Panel>
      </div>

      {/* Leads da LP */}
      <Panel
        title="Leads da landing page"
        subtitle="Recebidos pela LP (cruzados com anúncio/campanha pelas UTMs) — base do custo por lead real"
      >
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Leads recebidos na LP" icon={UserPlus} value={fmt(lpCur.length)} current={lpCur.length} previous={hasPrevious ? lpPrev.length : null} color={BRAND.green} />
          <Kpi label="CPL real (LP)" icon={Target} value={lpCur.length ? brl(lpCpl) : "—"} current={lpCpl} previous={hasPrevious ? prevLpCpl : null} color={BRAND.red} invert hint="Investido ÷ leads da LP" />
          <Kpi label="Com anúncio identificado" icon={Megaphone} value={percent(lpCur.filter((l) => l.matched_ad_id).length, lpCur.length, 0)} hint={`${fmt(lpCur.filter((l) => l.matched_ad_id).length)} de ${fmt(lpCur.length)} leads`} color={BRAND.steel} />
          <Kpi label="Leads Meta × LP" icon={Zap} value={`${fmt(totals.leads)} × ${fmt(lpCur.length)}`} hint="Conversões do Gerenciador × recebidos" color={BRAND.yellow} />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="mb-1 text-xs font-bold text-blue-900">Leads por dia</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={lpByDay} margin={{ left: -24, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                <RTooltip content={<ChartTooltip />} cursor={{ fill: "#f4f6f8" }} />
                <Bar isAnimationActive={false} dataKey="leads" name="Leads" fill={BRAND.green} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold text-blue-900">Por estado</p>
            <BarList items={lpStates} total={lpCur.length} color={BRAND.green} />
          </div>
        </div>
        <div className="mt-5">
          <p className="mb-2 text-xs font-bold text-blue-900">Por campanha</p>
          <BarList items={lpCampaigns} total={lpCur.length} color={BRAND.yellow} />
        </div>
      </Panel>

      {/* Destaques */}
      {highlights.length > 0 && (
        <Panel title="Destaques do período" subtitle={`Leitura automática · ${label}`}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {highlights.map((h) => (
              <Insight key={h.key + h.title} icon={HIGHLIGHT_ICONS[h.key]} title={h.title}>
                {h.text}
              </Insight>
            ))}
          </div>
        </Panel>
      )}

      {/* Criativos vinculados (vitalício) */}
      <Panel title="Top 5 criativos vinculados" subtitle="Desempenho vitalício (fora do filtro de período)">
        {topCreatives.length === 0 ? (
          <p className="text-sm text-gray-400">{loading ? "Carregando..." : "Nenhum criativo com anúncio vinculado ainda."}</p>
        ) : (
          <BarList
            items={topCreatives.map((c) => ({
              label: c.name,
              value: c.conversions,
              hint: `${currencyFormatter.format(c.spend)} · ${numberFormatter.format(c.impressions)} impr.`,
            }))}
            format={(n) => `${numberFormatter.format(n)} conv.`}
            color={BRAND.green}
          />
        )}
      </Panel>

      <Dialog open={!!preview} onClose={() => setPreview(null)} size="lg">
        <DialogHeader title="Preview do anúncio" subtitle={preview?.adName} onClose={() => setPreview(null)} />
        <DialogBody className="flex justify-center">
          {preview?.loading && <p className="py-10 text-sm text-gray-500">Carregando preview...</p>}
          {preview?.error && <p className="py-10 text-sm text-[color:var(--color-danger)]">{preview.error}</p>}
          {preview?.url && (
            <iframe src={preview.url} className="h-[min(600px,70dvh)] w-full max-w-sm rounded-xl border border-gray-200" title={`Preview — ${preview.adName}`} />
          )}
        </DialogBody>
      </Dialog>
    </div>
  );
}
