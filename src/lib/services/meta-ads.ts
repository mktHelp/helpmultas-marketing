import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetaAd, MetaAdSet, MetaCampaign } from "@/types/database";

export interface Metrics {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

function zeroMetrics(): Metrics {
  return { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
}

function addMetrics(a: Metrics, b: Metrics): Metrics {
  return {
    spend: a.spend + b.spend,
    impressions: a.impressions + b.impressions,
    clicks: a.clicks + b.clicks,
    conversions: a.conversions + b.conversions,
  };
}

// Mesmo critério usado no sync (app/api/meta-ads/sync) pra alimentar
// creatives.conversions: soma as actions cujo tipo contém "lead".
function leadsFromActions(actions: { action_type: string; value: string }[] | null): number {
  return (actions ?? [])
    .filter((a) => a.action_type.includes("lead"))
    .reduce((sum, a) => sum + Number(a.value || 0), 0);
}

interface RawInsightRow {
  ad_id: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function defaultDateRange(): DateRange {
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - 6);
  return { since: toDateOnly(since), until: toDateOnly(until) };
}

export interface TrafficStructure {
  campaigns: MetaCampaign[];
  adSets: (MetaAdSet & { campaign?: Pick<MetaCampaign, "id" | "name"> | null })[];
  ads: MetaAd[];
  insights: RawInsightRow[];
  // Menor e maior data disponível nos dados sincronizados — usado pra
  // limitar o seletor de datas da UI a um intervalo que de fato tem dado.
  minDate: string | null;
  maxDate: string | null;
}

export interface AdRow extends MetaAd {
  metrics: Metrics;
}

export interface AdSetRow extends MetaAdSet {
  campaign?: Pick<MetaCampaign, "id" | "name"> | null;
  adsCount: number;
  metrics: Metrics;
}

export interface CampaignRow extends MetaCampaign {
  adSetsCount: number;
  adsCount: number;
  metrics: Metrics;
}

export interface TrafficData {
  campaigns: CampaignRow[];
  adSets: AdSetRow[];
  ads: AdRow[];
}

export interface DateRange {
  since: string; // "YYYY-MM-DD"
  until: string; // "YYYY-MM-DD"
}

// Busca toda a estrutura (campanha → conjunto → anúncio) e todas as métricas
// diárias que o sync guardou (ver INSIGHTS_SYNC_DAYS em app/api/meta-ads/sync)
// de uma vez só, sem filtrar por data — o filtro de período é aplicado depois,
// no client, por aggregateTraffic(). Assim trocar o intervalo no seletor de
// datas não faz uma nova viagem ao banco, só reprocessa o que já está em
// memória (volume pequeno: dezenas de campanhas, centenas de anúncios).
export async function loadTrafficStructure(supabase: SupabaseClient): Promise<TrafficStructure> {
  const [campaignsRes, adSetsRes, adsRes, insightsRes] = await Promise.all([
    supabase.from("meta_campaigns").select("*").order("name"),
    supabase.from("meta_ad_sets").select("*, campaign:meta_campaigns(id, name)").order("name"),
    supabase
      .from("meta_ads")
      .select("*, adset:meta_ad_sets(id, name, campaign:meta_campaigns(id, name)), matched_creative:creatives(id, name)")
      .order("name"),
    supabase.from("meta_ad_insights").select("ad_id, date, spend, impressions, clicks, actions"),
  ]);
  if (campaignsRes.error) throw campaignsRes.error;
  if (adSetsRes.error) throw adSetsRes.error;
  if (adsRes.error) throw adsRes.error;
  if (insightsRes.error) throw insightsRes.error;

  const insights = (insightsRes.data ?? []).map((row) => ({
    ad_id: row.ad_id,
    date: row.date,
    spend: Number(row.spend),
    impressions: Number(row.impressions),
    clicks: Number(row.clicks),
    conversions: leadsFromActions(row.actions),
  }));

  let minDate: string | null = null;
  let maxDate: string | null = null;
  for (const row of insights) {
    if (!minDate || row.date < minDate) minDate = row.date;
    if (!maxDate || row.date > maxDate) maxDate = row.date;
  }

  return {
    campaigns: (campaignsRes.data ?? []) as MetaCampaign[],
    adSets: (adSetsRes.data ?? []) as unknown as TrafficStructure["adSets"],
    ads: (adsRes.data ?? []) as unknown as MetaAd[],
    insights,
    minDate,
    maxDate,
  };
}

export interface DailyPoint extends Metrics {
  date: string;
}

// Série diária somada (spend/impressions/clicks/conversions por dia) dentro
// do período, opcionalmente restrita a um conjunto de anúncios (ex: só os
// anúncios de uma campanha/conjunto/anúncio selecionado no dashboard).
// adIds = null significa "todos os anúncios".
export function dailySeries(structure: TrafficStructure, range: DateRange, adIds: Set<string> | null): DailyPoint[] {
  const byDate = new Map<string, Metrics>();
  for (const row of structure.insights) {
    if (row.date < range.since || row.date > range.until) continue;
    if (adIds && !adIds.has(row.ad_id)) continue;
    byDate.set(row.date, addMetrics(byDate.get(row.date) ?? zeroMetrics(), row));
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, m]) => ({ date, ...m }));
}

// Espelha a estrutura do Gerenciador de Anúncios da Meta: campanha → conjunto
// de anúncios → anúncio, cada nível com suas próprias métricas somadas do
// período escolhido (não é a mesma métrica repetida três vezes — um conjunto
// soma os anúncios dele, uma campanha soma os conjuntos dela).
export function aggregateTraffic(structure: TrafficStructure, range: DateRange): TrafficData {
  const metricsByAd = new Map<string, Metrics>();
  for (const row of structure.insights) {
    if (row.date < range.since || row.date > range.until) continue;
    metricsByAd.set(row.ad_id, addMetrics(metricsByAd.get(row.ad_id) ?? zeroMetrics(), row));
  }

  const ads: AdRow[] = structure.ads.map((ad) => ({ ...ad, metrics: metricsByAd.get(ad.id) ?? zeroMetrics() }));

  const metricsByAdSet = new Map<string, Metrics>();
  const adsCountByAdSet = new Map<string, number>();
  for (const ad of ads) {
    metricsByAdSet.set(ad.adset_id, addMetrics(metricsByAdSet.get(ad.adset_id) ?? zeroMetrics(), ad.metrics));
    adsCountByAdSet.set(ad.adset_id, (adsCountByAdSet.get(ad.adset_id) ?? 0) + 1);
  }

  const adSets: AdSetRow[] = structure.adSets.map((adSet) => ({
    ...adSet,
    adsCount: adsCountByAdSet.get(adSet.id) ?? 0,
    metrics: metricsByAdSet.get(adSet.id) ?? zeroMetrics(),
  }));

  const metricsByCampaign = new Map<string, Metrics>();
  const adSetsCountByCampaign = new Map<string, number>();
  const adsCountByCampaign = new Map<string, number>();
  for (const adSet of adSets) {
    metricsByCampaign.set(adSet.campaign_id, addMetrics(metricsByCampaign.get(adSet.campaign_id) ?? zeroMetrics(), adSet.metrics));
    adSetsCountByCampaign.set(adSet.campaign_id, (adSetsCountByCampaign.get(adSet.campaign_id) ?? 0) + 1);
    adsCountByCampaign.set(adSet.campaign_id, (adsCountByCampaign.get(adSet.campaign_id) ?? 0) + adSet.adsCount);
  }

  const campaigns: CampaignRow[] = structure.campaigns.map((campaign) => ({
    ...campaign,
    adSetsCount: adSetsCountByCampaign.get(campaign.id) ?? 0,
    adsCount: adsCountByCampaign.get(campaign.id) ?? 0,
    metrics: metricsByCampaign.get(campaign.id) ?? zeroMetrics(),
  }));

  return { campaigns, adSets, ads };
}
