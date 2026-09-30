import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";
import { leadsFromActions } from "@/lib/services/meta-ads";
import { rematchUnmatchedLeads } from "@/lib/lead-matching";

// Sync somente-leitura do Gerenciador de Anúncios da Meta (Marketing API)
// para as tabelas meta_*. Dois jeitos de disparar:
//   GET  — pelo Vercel Cron (ver vercel.json), autenticado com CRON_SECRET.
//   POST — pelo botão "Sincronizar agora" no Hub, autenticado pela sessão
//          do usuário (só time interno, mesma regra de app/(app)/layout.tsx).
// Os dois escrevem com a service-role (não há RLS de usuário aplicável a
// upsert em massa) e chamam o mesmo runSync().
//
// Busca só campanhas com effective_status = ACTIVE; campanhas sincronizadas
// antes que saíram desse filtro são marcadas active_in_meta = false (mantém
// histórico, some da UI por padrão).
//
// Depois de sincronizar a estrutura, tenta casar cada anúncio com um
// criativo da tabela `creatives` pelo nome (case-insensitive, sem espaços
// nas pontas) — só quando ainda não há vínculo manual. Anúncios casados têm
// suas métricas de vida (impressions/clicks/spend/conversions) copiadas
// para o criativo correspondente.
//
// Cada chamada cria uma linha em meta_sync_runs e vai atualizando
// progress_message em português conforme avança — o botão do front lê isso
// via Supabase Realtime pra mostrar o andamento em linguagem natural.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Quantos dias de métricas diárias manter sincronizados — define até onde
// o seletor de datas livre da aba "Tráfego Pago" consegue voltar.
const INSIGHTS_SYNC_DAYS = 90;
const INSIGHTS_UPSERT_BATCH = 500;

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface GraphAction {
  action_type: string;
  value: string;
}

interface GraphError {
  error?: { message: string; code: number };
}

interface GraphPaging {
  paging?: { next?: string };
}

const STOPWORDS = new Set([
  "DE", "DO", "DA", "DOS", "DAS", "A", "O", "OS", "AS", "EM", "PARA", "POR", "COM", "E", "UM", "UMA", "AO", "AOS", "NA", "NO",
]);

function normalizeTokens(value: string): string[] {
  const normalized = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
  return normalized.match(/[A-Z]+|\d+/g) ?? [];
}

function significantTokens(value: string): string[] {
  return normalizeTokens(value).filter((t) => !STOPWORDS.has(t));
}

function requireToken(): string {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) throw new Error("META_SYSTEM_USER_TOKEN não configurado");
  return token;
}

async function fetchWithRetry(url: string, attempt = 1): Promise<Response> {
  const res = await fetch(url);
  if (res.status === 429 && attempt <= 3) {
    await new Promise((r) => setTimeout(r, attempt * 2000));
    return fetchWithRetry(url, attempt + 1);
  }
  return res;
}

async function graphGetSingle<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = `${GRAPH_BASE}${path}?${new URLSearchParams({ ...params, access_token: requireToken() })}`;
  const res = await fetchWithRetry(url);
  const json = (await res.json()) as T & GraphError;
  if (json.error) throw new Error(`Meta API (${path}): ${json.error.message}`);
  return json;
}

async function graphGetEdge<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const results: T[] = [];
  let url = `${GRAPH_BASE}${path}?${new URLSearchParams({ ...params, access_token: requireToken() })}`;
  while (url) {
    const res = await fetchWithRetry(url);
    const json = (await res.json()) as { data?: T[] } & GraphPaging & GraphError;
    if (json.error) throw new Error(`Meta API (${path}): ${json.error.message}`);
    results.push(...(json.data ?? []));
    url = json.paging?.next ?? "";
  }
  return results;
}

interface RawCampaign {
  id: string;
  name: string;
  objective: string;
  status: string;
  effective_status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
}

interface RawAdSet {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  optimization_goal?: string;
  billing_event?: string;
  daily_budget?: string;
  start_time?: string;
  end_time?: string;
}

interface RawAd {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  adset_id: string;
  creative?: { id: string; thumbnail_url?: string };
}

interface RawDailyInsight {
  ad_id: string;
  date_start: string;
  spend: string;
  impressions: string;
  // inline_link_clicks (cliques no link) em vez de "clicks" (todo clique no
  // anúncio, incluindo curtida/comentário/expandir foto/perfil da página).
  inline_link_clicks: string;
  reach: string;
  frequency?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: GraphAction[];
}

interface RawLifetimeInsight {
  ad_id: string;
  spend: string;
  impressions: string;
  inline_link_clicks: string;
  actions?: GraphAction[];
}

async function setProgress(admin: SupabaseClient, runId: string, message: string) {
  await admin.from("meta_sync_runs").update({ progress_message: message }).eq("id", runId);
}

async function runSync(admin: SupabaseClient, runId: string, startedAt: string) {
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!accountId) throw new Error("META_AD_ACCOUNT_ID não configurado");

  const entities = { campaigns: 0, adsets: 0, ads: 0, insight_rows: 0, matched_creatives: 0, rematched_leads: 0 };

  // 1. Conta de anúncios
  await setProgress(admin, runId, "Conectando com a conta de anúncios da Meta...");
  const accountInfo = await graphGetSingle<{
    name: string;
    currency: string;
    timezone_name: string;
    account_status: number;
  }>(`/${accountId}`, { fields: "name,currency,timezone_name,account_status" });

  const { data: accountRow, error: accountError } = await admin
    .from("meta_ad_accounts")
    .upsert(
      {
        meta_account_id: accountId,
        name: accountInfo.name,
        currency: accountInfo.currency,
        timezone_name: accountInfo.timezone_name,
        status: String(accountInfo.account_status),
        last_synced_at: startedAt,
      },
      { onConflict: "meta_account_id" }
    )
    .select("id")
    .single();
  if (accountError || !accountRow) throw new Error(`Falha ao salvar meta_ad_accounts: ${accountError?.message}`);

  // 2. Campanhas ativas
  await setProgress(admin, runId, "Buscando campanhas ativas...");
  const campaigns = await graphGetEdge<RawCampaign>(`/${accountId}/campaigns`, {
    fields: "id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time",
    filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE"] }]),
    limit: "200",
  });
  entities.campaigns = campaigns.length;
  const activeCampaignMetaIds = campaigns.map((c) => c.id);
  await setProgress(admin, runId, `${campaigns.length} campanhas ativas encontradas. Salvando...`);

  const campaignIdByMetaId = new Map<string, string>();
  for (const c of campaigns) {
    const { data, error } = await admin
      .from("meta_campaigns")
      .upsert(
        {
          meta_campaign_id: c.id,
          account_id: accountRow.id,
          name: c.name,
          objective: c.objective,
          status: c.effective_status,
          active_in_meta: true,
          daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
          lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
          start_time: c.start_time ?? null,
          stop_time: c.stop_time ?? null,
          synced_at: startedAt,
        },
        { onConflict: "meta_campaign_id" }
      )
      .select("id")
      .single();
    if (error || !data) continue;
    campaignIdByMetaId.set(c.id, data.id);
  }

  // Campanhas que sincronizamos antes e não vieram mais como ativas.
  if (activeCampaignMetaIds.length > 0) {
    await admin
      .from("meta_campaigns")
      .update({ active_in_meta: false })
      .eq("account_id", accountRow.id)
      .not("meta_campaign_id", "in", `(${activeCampaignMetaIds.join(",")})`);
  } else {
    await admin.from("meta_campaigns").update({ active_in_meta: false }).eq("account_id", accountRow.id);
  }

  // 3. Conjuntos de anúncios dentro das campanhas ativas
  await setProgress(admin, runId, "Sincronizando conjuntos de anúncios...");
  const adSets =
    activeCampaignMetaIds.length === 0
      ? []
      : await graphGetEdge<RawAdSet>(`/${accountId}/adsets`, {
          fields: "id,name,status,campaign_id,optimization_goal,billing_event,daily_budget,start_time,end_time",
          filtering: JSON.stringify([{ field: "campaign.id", operator: "IN", value: activeCampaignMetaIds }]),
          limit: "200",
        });
  entities.adsets = adSets.length;

  const adSetIdByMetaId = new Map<string, string>();
  for (const a of adSets) {
    const campaignId = campaignIdByMetaId.get(a.campaign_id);
    if (!campaignId) continue;
    const { data, error } = await admin
      .from("meta_ad_sets")
      .upsert(
        {
          meta_adset_id: a.id,
          campaign_id: campaignId,
          name: a.name,
          status: a.status,
          optimization_goal: a.optimization_goal ?? "",
          billing_event: a.billing_event ?? "",
          daily_budget: a.daily_budget ? Number(a.daily_budget) / 100 : null,
          start_time: a.start_time ?? null,
          end_time: a.end_time ?? null,
          synced_at: startedAt,
        },
        { onConflict: "meta_adset_id" }
      )
      .select("id")
      .single();
    if (error || !data) continue;
    adSetIdByMetaId.set(a.id, data.id);
  }

  // 4. Anúncios dentro desses conjuntos
  await setProgress(admin, runId, `${adSets.length} conjuntos sincronizados. Buscando os anúncios...`);
  const activeAdSetMetaIds = adSets.map((a) => a.id);
  const ads =
    activeAdSetMetaIds.length === 0
      ? []
      : await graphGetEdge<RawAd>(`/${accountId}/ads`, {
          fields: "id,name,status,effective_status,adset_id,creative{id,thumbnail_url}",
          filtering: JSON.stringify([{ field: "adset.id", operator: "IN", value: activeAdSetMetaIds }]),
          limit: "200",
        });
  entities.ads = ads.length;

  const adIdByMetaId = new Map<string, string>();
  const adRows = ads.flatMap((ad) => {
    const adSetId = adSetIdByMetaId.get(ad.adset_id);
    if (!adSetId) return [];
    return [
      {
        meta_ad_id: ad.id,
        adset_id: adSetId,
        name: ad.name,
        status: ad.status,
        effective_status: ad.effective_status,
        creative_meta_id: ad.creative?.id ?? "",
        thumbnail_url: ad.creative?.thumbnail_url ?? "",
        synced_at: startedAt,
      },
    ];
  });
  for (let i = 0; i < adRows.length; i += INSIGHTS_UPSERT_BATCH) {
    const { data, error } = await admin
      .from("meta_ads")
      .upsert(adRows.slice(i, i + INSIGHTS_UPSERT_BATCH), { onConflict: "meta_ad_id" })
      .select("id, meta_ad_id");
    if (error) throw new Error(`Falha ao salvar anúncios: ${error.message}`);
    for (const row of data ?? []) adIdByMetaId.set(row.meta_ad_id as string, row.id as string);
  }

  // 5. Casamento automático anúncio ↔ criativo, por conjunto de palavras
  // (só quando ainda não há vínculo — nunca sobrescreve um vínculo
  // definido manualmente). Os nomes dos anúncios seguem uma convenção de
  // campanha bem mais longa que o nome do criativo (ex: "15.09 [006]
  // [SUL/SUDESTE/CENTRO-OESTE] [CAPTACAO] [FRANQUIAS] [MODELO FRANQUIA]"
  // para o criativo "Modelo de Franquia"), então nome idêntico não serve —
  // consideramos match quando toda palavra significativa do criativo
  // aparece entre as palavras do anúncio, ignorando acento/caixa e
  // preposições. Em caso de mais de um criativo bater no mesmo anúncio,
  // fica o de maior número de palavras (o mais específico).
  await setProgress(admin, runId, `${ads.length} anúncios encontrados. Cruzando com os criativos cadastrados...`);
  const { data: creativeRows } = await admin.from("creatives").select("id, name");
  const creativeCandidates = (creativeRows ?? [])
    .map((c) => ({ id: c.id as string, tokens: significantTokens(c.name) }))
    // Exige pelo menos 2 palavras significativas — evita nome de criativo
    // genérico/curto (1 palavra) casando com anúncios não relacionados.
    .filter((c) => c.tokens.length >= 2);

  let matchedCount = 0;
  for (const ad of ads) {
    const internalAdId = adIdByMetaId.get(ad.id);
    if (!internalAdId) continue;
    const adTokens = new Set(normalizeTokens(ad.name));

    let best: { id: string; tokens: string[] } | null = null;
    for (const candidate of creativeCandidates) {
      if (candidate.tokens.every((t) => adTokens.has(t))) {
        if (!best || candidate.tokens.length > best.tokens.length) best = candidate;
      }
    }
    if (!best) continue;

    const { data } = await admin
      .from("meta_ads")
      .update({ matched_creative_id: best.id, matched_by: "auto_tokens" })
      .eq("id", internalAdId)
      .is("matched_creative_id", null)
      .select("id");
    if (data && data.length > 0) matchedCount++;
  }
  entities.matched_creatives = matchedCount;

  // Revincula leads da LP que chegaram antes do anúncio/campanha existir aqui.
  try {
    await setProgress(admin, runId, "Vinculando leads pendentes aos anúncios...");
    entities.rematched_leads = await rematchUnmatchedLeads(admin);
  } catch (err) {
    console.error("Erro ao revincular leads:", err);
  }

  // 6. Métricas
  const activeAdMetaIds = ads.map((a) => a.id);
  if (activeAdMetaIds.length > 0) {
    // 6a. Diárias (janela de INSIGHTS_SYNC_DAYS) — alimentam o seletor de
    // datas livre na aba "Tráfego Pago". time_range em vez de date_preset
    // porque precisamos de um intervalo maior que os presets padrão.
    await setProgress(admin, runId, "Baixando métricas diárias dos últimos 90 dias...");
    const until = new Date();
    const since = new Date();
    since.setDate(since.getDate() - INSIGHTS_SYNC_DAYS);
    const dailyInsights = await graphGetEdge<RawDailyInsight>(`/${accountId}/insights`, {
      level: "ad",
      time_increment: "1",
      time_range: JSON.stringify({ since: toDateOnly(since), until: toDateOnly(until) }),
      fields: "ad_id,date_start,spend,impressions,inline_link_clicks,reach,frequency,ctr,cpc,cpm,actions",
      filtering: JSON.stringify([{ field: "ad.id", operator: "IN", value: activeAdMetaIds }]),
      limit: "500",
    });

    await setProgress(admin, runId, `Salvando ${dailyInsights.length} linhas de métricas diárias...`);
    // Em lotes: um upsert por linha (~2.000+ idas ao banco em série) estourava
    // o maxDuration da função na Vercel. Dedup por (ad_id, date) porque o
    // Postgres recusa um mesmo lote atingir a mesma linha duas vezes.
    const insightRowsByKey = new Map<string, Record<string, unknown>>();
    for (const row of dailyInsights) {
      const internalAdId = adIdByMetaId.get(row.ad_id);
      if (!internalAdId) continue;
      insightRowsByKey.set(`${internalAdId}|${row.date_start}`, {
        ad_id: internalAdId,
        date: row.date_start,
        spend: Number(row.spend ?? 0),
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.inline_link_clicks ?? 0),
        reach: Number(row.reach ?? 0),
        frequency: row.frequency ? Number(row.frequency) : null,
        ctr: row.ctr ? Number(row.ctr) : null,
        cpc: row.cpc ? Number(row.cpc) : null,
        cpm: row.cpm ? Number(row.cpm) : null,
        actions: row.actions ?? [],
        synced_at: startedAt,
      });
    }
    const insightRows = [...insightRowsByKey.values()];
    for (let i = 0; i < insightRows.length; i += INSIGHTS_UPSERT_BATCH) {
      const batch = insightRows.slice(i, i + INSIGHTS_UPSERT_BATCH);
      const { error } = await admin.from("meta_ad_insights").upsert(batch, { onConflict: "ad_id,date" });
      if (error) throw new Error(`Falha ao salvar métricas diárias: ${error.message}`);
      entities.insight_rows += batch.length;
    }

    // 6b. Vitalícias (date_preset=maximum), só usadas para atualizar as
    // colunas impressions/clicks/spend/conversions da tabela creatives
    // nos anúncios que têm criativo casado.
    await setProgress(admin, runId, "Atualizando métricas dos criativos vinculados...");
    const lifetimeInsights = await graphGetEdge<RawLifetimeInsight>(`/${accountId}/insights`, {
      level: "ad",
      date_preset: "maximum",
      fields: "ad_id,spend,impressions,inline_link_clicks,actions",
      filtering: JSON.stringify([{ field: "ad.id", operator: "IN", value: activeAdMetaIds }]),
      limit: "500",
    });

    const { data: matchedAds } = await admin
      .from("meta_ads")
      .select("meta_ad_id, matched_creative_id")
      .in("meta_ad_id", activeAdMetaIds)
      .not("matched_creative_id", "is", null);

    const creativeIdByMetaAdId = new Map(
      (matchedAds ?? []).map((r) => [r.meta_ad_id as string, r.matched_creative_id as string])
    );

    for (const row of lifetimeInsights) {
      const creativeId = creativeIdByMetaAdId.get(row.ad_id);
      if (!creativeId) continue;
      const conversions = leadsFromActions(row.actions ?? null);

      await admin
        .from("creatives")
        .update({
          impressions: Number(row.impressions ?? 0),
          clicks: Number(row.inline_link_clicks ?? 0),
          spend: Number(row.spend ?? 0),
          conversions,
        })
        .eq("id", creativeId);
    }
  }

  return entities;
}

async function startRun(admin: SupabaseClient) {
  const startedAt = new Date().toISOString();
  const { data: run, error } = await admin
    .from("meta_sync_runs")
    .insert({ started_at: startedAt, status: "running", progress_message: "Iniciando sincronização..." })
    .select("id")
    .single();
  if (error || !run) throw new Error(`Falha ao iniciar o sync: ${error?.message}`);
  return { runId: run.id as string, startedAt };
}

async function finishRun(admin: SupabaseClient, runId: string, entities: Record<string, number> | null, err: unknown) {
  if (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    await admin
      .from("meta_sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "error",
        entities_synced: entities ?? {},
        error_message: message,
        progress_message: `Falhou: ${message}`,
      })
      .eq("id", runId);
    return NextResponse.json({ ok: false, error: message, runId }, { status: 500 });
  }
  await admin
    .from("meta_sync_runs")
    .update({
      finished_at: new Date().toISOString(),
      status: "success",
      entities_synced: entities ?? {},
      progress_message: "Sincronização concluída.",
    })
    .eq("id", runId);
  return NextResponse.json({ ok: true, entities, runId });
}

export async function GET(request: Request) {
  // CRON_SECRET (não META_SYNC_SECRET) de propósito: é o nome que a própria
  // Vercel reconhece e usa pra anexar "Authorization: Bearer <valor>"
  // automaticamente nas chamadas que ela faz pros crons definidos em
  // vercel.json — sem isso, não tem como configurar esse header por lá.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 500 });
  }
  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { runId, startedAt } = await startRun(admin);
  try {
    const entities = await runSync(admin, runId, startedAt);
    return await finishRun(admin, runId, entities, null);
  } catch (err) {
    return await finishRun(admin, runId, null, err);
  }
}

// Disparado pelo botão "Sincronizar agora" no Hub — exige sessão de usuário
// autenticado (qualquer role interna, incluindo expansão).
export async function POST() {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { runId, startedAt } = await startRun(admin);
  try {
    const entities = await runSync(admin, runId, startedAt);
    return await finishRun(admin, runId, entities, null);
  } catch (err) {
    return await finishRun(admin, runId, null, err);
  }
}
