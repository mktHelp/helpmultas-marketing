import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchScriptsForAds } from "@/lib/services/adScriptLinks";
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
// creatives.conversions. A Meta manda VÁRIOS action_types pro mesmo lead
// (ex: "lead", "onsite_conversion.lead_grouped",
// "offsite_complete_registration_add_meta_leads" — todos com o mesmo valor
// pro mesmo evento), então somar tudo que contém "lead" multiplica a
// contagem. Usamos só o tipo "agrupado" que a própria Meta recomenda pra
// relatório, com "lead" como fallback pra campanhas antigas que só tenham
// esse.
const LEAD_ACTION_TYPES = ["onsite_conversion.lead_grouped", "lead"];

export function actionValue(actions: { action_type: string; value: string }[] | null, type: string): number {
  const match = actions?.find((a) => a.action_type === type);
  return match ? Number(match.value || 0) : 0;
}

export function leadsFromActions(actions: { action_type: string; value: string }[] | null): number {
  if (!actions) return 0;
  for (const type of LEAD_ACTION_TYPES) {
    const match = actions.find((a) => a.action_type === type);
    if (match) return Number(match.value || 0);
  }
  return 0;
}

interface RawInsightRow {
  ad_id: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  reach: number;
  // Visitas à landing page (landing_page_view) — meio do funil entre o
  // clique no anúncio e o lead.
  lpViews: number;
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

// O PostgREST (Supabase) devolve no máximo 1000 linhas por chamada, mesmo
// sem informar limit — com meses de histórico diário por anúncio, a tabela
// de insights passa disso rápido. Sem paginar aqui, a consulta trunca
// silenciosamente e os totais do dashboard ficam menores que o real.
const INSIGHTS_PAGE_SIZE = 1000;

interface RawInsightsRow {
  ad_id: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number | null;
  actions: { action_type: string; value: string }[] | null;
}

async function fetchAllInsights(supabase: SupabaseClient): Promise<RawInsightsRow[]> {
  const rows: RawInsightsRow[] = [];
  for (let from = 0; ; from += INSIGHTS_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("meta_ad_insights")
      .select("ad_id, date, spend, impressions, clicks, reach, actions")
      .range(from, from + INSIGHTS_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as RawInsightsRow[]));
    if (!data || data.length < INSIGHTS_PAGE_SIZE) break;
  }
  return rows;
}

// Busca toda a estrutura (campanha → conjunto → anúncio) e todas as métricas
// diárias que o sync guardou (ver INSIGHTS_SYNC_DAYS em app/api/meta-ads/sync)
// de uma vez só, sem filtrar por data — o filtro de período é aplicado depois,
// no client, por aggregateTraffic(). Assim trocar o intervalo no seletor de
// datas não faz uma nova viagem ao banco, só reprocessa o que já está em
// memória (volume pequeno: dezenas de campanhas, centenas de anúncios).
export async function loadTrafficStructure(supabase: SupabaseClient): Promise<TrafficStructure> {
  const [campaignsRes, adSetsRes, adsRes, rawInsights] = await Promise.all([
    supabase.from("meta_campaigns").select("*").order("name"),
    supabase.from("meta_ad_sets").select("*, campaign:meta_campaigns(id, name)").order("name"),
    supabase
      .from("meta_ads")
      .select("*, adset:meta_ad_sets(id, name, campaign:meta_campaigns(id, name)), matched_creative:creatives(id, name)")
      .order("name"),
    fetchAllInsights(supabase),
  ]);
  if (campaignsRes.error) throw campaignsRes.error;
  if (adSetsRes.error) throw adSetsRes.error;
  if (adsRes.error) throw adsRes.error;

  const insights = rawInsights.map((row) => ({
    ad_id: row.ad_id,
    date: row.date,
    spend: Number(row.spend),
    impressions: Number(row.impressions),
    clicks: Number(row.clicks),
    conversions: leadsFromActions(row.actions),
    reach: Number(row.reach ?? 0),
    lpViews: actionValue(row.actions, "landing_page_view"),
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

export interface LeadAdCount {
  adId: string;
  adName: string;
  count: number;
}

export interface LeadStats {
  topAds: LeadAdCount[];
  unmatched: number;
  total: number;
}

const LEADS_PAGE_SIZE = 1000;

// Conta os leads da LP (landing_page_leads, ver app/api/leads) por anúncio
// vinculado, dentro do período — base do ranking "anúncios campeões".
// Paginado pelo mesmo motivo do fetchAllInsights acima: sem .range(), o
// Supabase corta em 1000 linhas por chamada.
export async function countLeadsByAd(supabase: SupabaseClient, range: DateRange): Promise<LeadStats> {
  const rows: { matched_ad_id: string | null }[] = [];
  for (let from = 0; ; from += LEADS_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("landing_page_leads")
      .select("matched_ad_id")
      .gte("received_at", `${range.since}T00:00:00`)
      .lte("received_at", `${range.until}T23:59:59`)
      .range(from, from + LEADS_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < LEADS_PAGE_SIZE) break;
  }

  const countByAd = new Map<string, number>();
  let unmatched = 0;
  for (const row of rows) {
    if (!row.matched_ad_id) {
      unmatched++;
      continue;
    }
    countByAd.set(row.matched_ad_id, (countByAd.get(row.matched_ad_id) ?? 0) + 1);
  }

  const adIds = [...countByAd.keys()];
  const names = new Map<string, string>();
  if (adIds.length > 0) {
    const { data: ads } = await supabase.from("meta_ads").select("id, name").in("id", adIds);
    for (const a of ads ?? []) names.set(a.id, a.name);
  }

  const topAds = [...countByAd.entries()]
    .map(([adId, count]) => ({ adId, adName: names.get(adId) ?? "—", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return { topAds, unmatched, total: rows.length };
}

export interface LeadRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  utm_id: string;
  fbclid: string;
  fbp: string;
  fbc: string;
  capital: string;
  capital_label: string;
  page_origin: string;
  matched_by: string | null;
  matched_ad_id: string | null;
  matched_adset_id: string | null;
  matched_campaign_id: string | null;
  received_at: string;
  matched_ad?: { id: string; meta_ad_id: string; name: string; adset?: { id: string; name: string; campaign?: { id: string; name: string } } } | null;
  matched_adset?: { id: string; name: string } | null;
  matched_campaign?: { id: string; name: string } | null;
}

export interface LeadsPage {
  rows: LeadRow[];
  total: number;
}

export interface LeadsFilter {
  range: DateRange;
  search: string;
  campaignId: string;
  adId: string;
  matchStatus: "" | "matched" | "unmatched";
  pageOrigin: string;
  page: number;
  pageSize: number;
}

export async function fetchLeads(supabase: SupabaseClient, filter: LeadsFilter): Promise<LeadsPage> {
  let query = supabase
    .from("landing_page_leads")
    .select(
      "id, name, email, phone, city, state, capital, capital_label, page_origin, utm_source, utm_medium, utm_campaign, utm_content, utm_term, utm_id, fbclid, fbp, fbc, matched_by, matched_ad_id, matched_adset_id, matched_campaign_id, received_at, matched_ad:meta_ads(id, meta_ad_id, name, adset:meta_ad_sets(id, name, campaign:meta_campaigns(id, name))), matched_adset:meta_ad_sets!matched_adset_id(id, name), matched_campaign:meta_campaigns!matched_campaign_id(id, name)",
      { count: "exact" }
    )
    .gte("received_at", `${filter.range.since}T00:00:00`)
    .lte("received_at", `${filter.range.until}T23:59:59`)
    .order("received_at", { ascending: false });

  // Vírgula, parênteses e curingas quebrariam a sintaxe do .or() do PostgREST.
  const term = filter.search.replace(/[,()%*\\]/g, " ").trim();
  if (term) {
    const cols = ["name", "email", "phone", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id"];
    query = query.or(cols.map((c) => `${c}.ilike.%${term}%`).join(","));
  }
  if (filter.campaignId) {
    query = query.eq("matched_campaign_id", filter.campaignId);
  }
  if (filter.adId) {
    query = query.eq("matched_ad_id", filter.adId);
  }
  if (filter.pageOrigin) {
    query = query.eq("page_origin", filter.pageOrigin);
  }
  if (filter.matchStatus === "matched") {
    query = query.not("matched_ad_id", "is", null);
  } else if (filter.matchStatus === "unmatched") {
    query = query.is("matched_ad_id", null);
  }

  const from = filter.page * filter.pageSize;
  query = query.range(from, from + filter.pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    rows: (data ?? []) as unknown as LeadRow[],
    total: count ?? 0,
  };
}

export interface LeadAdRankItem {
  adId: string;
  // ID do anúncio na Meta — usado pra gerar o preview.
  metaAdId: string | null;
  adName: string;
  thumbnailUrl: string | null;
  adsetName: string | null;
  campaignName: string | null;
  leads: number;
  // % sobre TODOS os leads do período (inclusive os sem vínculo).
  share: number;
  // Investimento da Meta no mesmo período, e custo por lead da LP
  // (investimento ÷ leads recebidos). null quando não há investimento.
  spend: number;
  cpl: number | null;
  // Roteiro do Teleprompter vinculado a este anúncio (tabela meta_ad_scripts).
  script: { id: string; title: string } | null;
}

export interface LeadAdRanking {
  items: LeadAdRankItem[];
  totalLeads: number;
  matchedLeads: number;
}

export async function fetchLeadAdRanking(
  supabase: SupabaseClient,
  range: DateRange,
  limit = 5
): Promise<LeadAdRanking> {
  const rows: { matched_ad_id: string | null }[] = [];
  for (let from = 0; ; from += LEADS_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("landing_page_leads")
      .select("matched_ad_id")
      .gte("received_at", `${range.since}T00:00:00`)
      .lte("received_at", `${range.until}T23:59:59`)
      .range(from, from + LEADS_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < LEADS_PAGE_SIZE) break;
  }

  const countByAd = new Map<string, number>();
  let matchedLeads = 0;
  for (const row of rows) {
    if (!row.matched_ad_id) continue;
    matchedLeads++;
    countByAd.set(row.matched_ad_id, (countByAd.get(row.matched_ad_id) ?? 0) + 1);
  }

  const topIds = [...countByAd.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (topIds.length === 0) return { items: [], totalLeads: rows.length, matchedLeads };

  const { data: ads } = await supabase
    .from("meta_ads")
    .select("id, meta_ad_id, name, thumbnail_url, adset:meta_ad_sets(name, campaign:meta_campaigns(name))")
    .in("id", topIds);
  const infoById = new Map<string, { name: string; metaAdId: string | null; thumbnailUrl: string | null; adsetName: string | null; campaignName: string | null }>();
  for (const a of (ads ?? []) as unknown as {
    id: string;
    meta_ad_id: string | null;
    name: string;
    thumbnail_url: string | null;
    adset: { name: string; campaign: { name: string } | { name: string }[] | null } | { name: string; campaign: unknown }[] | null;
  }[]) {
    const adset = (Array.isArray(a.adset) ? a.adset[0] : a.adset) as
      | { name: string; campaign: { name: string } | { name: string }[] | null }
      | undefined;
    const campaign = adset ? (Array.isArray(adset.campaign) ? adset.campaign[0] : adset.campaign) : null;
    infoById.set(a.id, { name: a.name, metaAdId: a.meta_ad_id, thumbnailUrl: a.thumbnail_url || null, adsetName: adset?.name ?? null, campaignName: campaign?.name ?? null });
  }

  const spendById = new Map<string, number>();
  for (let from = 0; ; from += INSIGHTS_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("meta_ad_insights")
      .select("ad_id, spend")
      .in("ad_id", topIds)
      .gte("date", range.since)
      .lte("date", range.until)
      .range(from, from + INSIGHTS_PAGE_SIZE - 1);
    if (error) throw error;
    for (const r of data ?? []) spendById.set(r.ad_id, (spendById.get(r.ad_id) ?? 0) + Number(r.spend));
    if (!data || data.length < INSIGHTS_PAGE_SIZE) break;
  }

  const scriptByAd = await fetchScriptsForAds(supabase, topIds);

  const items = topIds.map((adId) => {
    const leads = countByAd.get(adId) ?? 0;
    const spend = spendById.get(adId) ?? 0;
    const info = infoById.get(adId);
    return {
      adId,
      adName: info?.name ?? "—",
      metaAdId: info?.metaAdId ?? null,
      thumbnailUrl: info?.thumbnailUrl ?? null,
      adsetName: info?.adsetName ?? null,
      campaignName: info?.campaignName ?? null,
      leads,
      share: rows.length > 0 ? (leads / rows.length) * 100 : 0,
      spend,
      cpl: spend > 0 && leads > 0 ? spend / leads : null,
      script: scriptByAd.has(adId) ? { id: scriptByAd.get(adId)!.scriptId, title: scriptByAd.get(adId)!.title } : null,
    };
  });

  return { items, totalLeads: rows.length, matchedLeads };
}

export interface LandingLead {
  received_at: string;
  state: string;
  matched_campaign_id: string | null;
  matched_adset_id: string | null;
  matched_ad_id: string | null;
}

// Leads da LP recebidos entre duas datas (YYYY-MM-DD, horário de São Paulo),
// com paginação pelo mesmo motivo de fetchAllInsights.
export async function loadLandingLeads(supabase: SupabaseClient, from: string, to: string): Promise<LandingLead[]> {
  const startIso = `${from}T03:00:00Z`;
  const endIso = new Date(Date.parse(`${to}T03:00:00Z`) + 86400000).toISOString();
  const rows: LandingLead[] = [];
  for (let offset = 0; ; offset += LEADS_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("landing_page_leads")
      .select("received_at, state, matched_campaign_id, matched_adset_id, matched_ad_id")
      .gte("received_at", startIso)
      .lt("received_at", endIso)
      .range(offset, offset + LEADS_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as LandingLead[]));
    if (!data || data.length < LEADS_PAGE_SIZE) break;
  }
  return rows;
}

export interface TrafficDayTotals {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
}

// Totais por dia (todas as campanhas) — resumo leve pra dashboard principal,
// sem carregar campanhas/conjuntos/anúncios.
export async function loadTrafficDaily(supabase: SupabaseClient): Promise<TrafficDayTotals[]> {
  const rows = await fetchAllInsights(supabase);
  const byDate = new Map<string, TrafficDayTotals>();
  for (const r of rows) {
    const cur = byDate.get(r.date) ?? { date: r.date, spend: 0, impressions: 0, clicks: 0, leads: 0 };
    cur.spend += Number(r.spend);
    cur.impressions += Number(r.impressions);
    cur.clicks += Number(r.clicks);
    cur.leads += leadsFromActions(r.actions);
    byDate.set(r.date, cur);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
