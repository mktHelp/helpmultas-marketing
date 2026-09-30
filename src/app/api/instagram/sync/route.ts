import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";

// Sync somente-leitura do Instagram para as tabelas instagram_*. Dois
// gatilhos, mesmo padrão de api/meta-ads/sync:
//   GET  — Vercel Cron (vercel.json), autenticado com CRON_SECRET; reprocessa
//          os últimos 3 dias (a Meta ainda ajusta os números do dia anterior).
//   POST — botão "Atualizar" da aba Instagram, sessão de usuário; puxa 60 dias
//          (?days=N, máx. 90).
//
// Por perfil grava: métricas diárias (instagram_daily_insights), posts/reels/
// stories individuais com métricas (instagram_media), público e dados do
// perfil (instagram_audience). Stories só aparecem na API por 24h, então só
// entram no histórico a partir do momento em que o sync diário os vê.
//
// Usa o Instagram Login (graph.instagram.com): um token de longa duração por
// perfil, guardado em instagram_tokens (só service-role) e renovado aqui
// mesmo quando faltam menos de 15 dias pra expirar. Cadastro: npm run ig-token.
//
// Dias são fechados no fuso de São Paulo (UTC-3).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GRAPH_BASE = "https://graph.instagram.com/v21.0";
const REFRESH_URL = "https://graph.instagram.com/refresh_access_token";
const REFRESH_WHEN_DAYS_LEFT = 15;
const CONCURRENCY = 8;
const BRT_OFFSET_SECONDS = 3 * 3600;

type Admin = ReturnType<typeof createAdminClient>;

interface Account {
  id: string;
  label: string;
}

interface TokenRow {
  access_token: string;
  expires_at: string;
}

interface BreakdownResult {
  dimension_values: string[];
  value: number;
}

interface InsightMetric {
  name: string;
  total_value?: {
    value?: number;
    breakdowns?: { results?: BreakdownResult[] }[];
  };
  values?: { value: number; end_time: string }[];
}

type Insights = { data: InsightMetric[] };

class GraphApiError extends Error {}

async function graph<T>(token: string, path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH_BASE}/${path}?${qs}`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new GraphApiError(json.error?.message || `Graph API ${res.status}`);
  }
  return json as T;
}

// Renova o token se estiver perto de expirar; devolve o token em uso.
async function ensureFreshToken(admin: Admin, accountId: string, row: TokenRow): Promise<string> {
  const daysLeft = (Date.parse(row.expires_at) - Date.now()) / 86400000;
  if (daysLeft > REFRESH_WHEN_DAYS_LEFT) return row.access_token;
  if (daysLeft <= 0) throw new GraphApiError("Token expirado — gere um novo e rode npm run ig-token");

  const qs = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: row.access_token });
  const res = await fetch(`${REFRESH_URL}?${qs}`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || !json.access_token) return row.access_token; // tenta com o atual
  await admin
    .from("instagram_tokens")
    .update({
      access_token: json.access_token,
      expires_at: new Date(Date.now() + (json.expires_in ?? 5184000) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", accountId);
  return json.access_token;
}

function dayRange(date: string): { since: string; until: string } {
  const start = Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000) + BRT_OFFSET_SECONDS;
  return { since: String(start), until: String(start + 86400) };
}

// Datas fechadas (YYYY-MM-DD, horário de SP), da mais antiga a ontem — o dia
// corrente ainda está incompleto.
function lastDates(days: number): string[] {
  const out: string[] = [];
  const now = new Date(Date.now() - BRT_OFFSET_SECONDS * 1000);
  for (let i = days; i >= 1; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function brtDate(iso: string): string {
  return new Date(Date.parse(iso) - BRT_OFFSET_SECONDS * 1000).toISOString().slice(0, 10);
}

function breakdownMap(metric: InsightMetric | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of metric?.total_value?.breakdowns?.[0]?.results ?? []) {
    out[r.dimension_values.join("|")] = r.value;
  }
  return out;
}

async function inChunks<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

// ── Métricas diárias ────────────────────────────────────────────────────────

async function fetchDay(token: string, date: string) {
  const { since, until } = dayRange(date);
  const base = { since, until, period: "day", metric_type: "total_value" };
  const q = (params: Record<string, string>) => graph<Insights>(token, "me/insights", { ...base, ...params });

  const [totals, viewsType, viewsFollow, reachType, reachFollow, interType] = await Promise.all([
    q({
      metric:
        "views,reach,accounts_engaged,total_interactions,likes,comments,shares,saves,profile_views,website_clicks,replies,reposts",
    }),
    q({ metric: "views", breakdown: "media_product_type" }),
    q({ metric: "views", breakdown: "follow_type" }),
    q({ metric: "reach", breakdown: "media_product_type" }),
    q({ metric: "reach", breakdown: "follow_type" }),
    q({ metric: "total_interactions", breakdown: "media_product_type" }),
  ]);

  const value = (name: string) => totals.data.find((m) => m.name === name)?.total_value?.value ?? 0;
  const viewsByFollow = breakdownMap(viewsFollow.data[0]);
  const reachByFollow = breakdownMap(reachFollow.data[0]);

  return {
    date,
    views: value("views"),
    views_followers: viewsByFollow.FOLLOWER ?? 0,
    views_non_followers: viewsByFollow.NON_FOLLOWER ?? 0,
    views_by_type: breakdownMap(viewsType.data[0]),
    reach: value("reach"),
    reach_followers: reachByFollow.FOLLOWER ?? 0,
    reach_non_followers: reachByFollow.NON_FOLLOWER ?? 0,
    reach_by_type: breakdownMap(reachType.data[0]),
    accounts_engaged: value("accounts_engaged"),
    total_interactions: value("total_interactions"),
    interactions_by_type: breakdownMap(interType.data[0]),
    likes: value("likes"),
    comments: value("comments"),
    shares: value("shares"),
    saves: value("saves"),
    profile_views: value("profile_views"),
    website_clicks: value("website_clicks"),
    replies: value("replies"),
    reposts: value("reposts"),
  };
}

// follower_count vem em série diária (ganho líquido de seguidores por dia),
// só nos últimos 30 dias — uma chamada cobre o período todo.
async function fetchNetFollowers(token: string, days: number): Promise<Record<string, number>> {
  const dates = lastDates(Math.min(days, 30));
  const { since } = dayRange(dates[0]);
  const { until } = dayRange(dates[dates.length - 1]);
  const res = await graph<Insights>(token, "me/insights", { metric: "follower_count", period: "day", since, until });
  const out: Record<string, number> = {};
  for (const v of res.data[0]?.values ?? []) {
    // end_time marca o fim do dia (00:00 de D+1); o dia em si é o anterior.
    const day = new Date(Date.parse(v.end_time) - BRT_OFFSET_SECONDS * 1000 - 86400 * 1000);
    out[day.toISOString().slice(0, 10)] = v.value;
  }
  return out;
}

async function syncDaily(admin: Admin, token: string, accountId: string, days: number) {
  const rows = await inChunks(lastDates(days), 5, (d) => fetchDay(token, d));
  const net = await fetchNetFollowers(token, days).catch(() => ({}) as Record<string, number>);
  const { error } = await admin.from("instagram_daily_insights").upsert(
    rows.map((r) => ({
      ...r,
      account_id: accountId,
      net_followers: net[r.date] ?? 0,
      synced_at: new Date().toISOString(),
    })),
    { onConflict: "account_id,date" }
  );
  if (error) throw error;
  return rows.length;
}

// ── Posts, reels e stories ─────────────────────────────────────────────────

interface RawMedia {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

const MEDIA_FIELDS =
  "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count";

async function listMedia(token: string, days: number): Promise<RawMedia[]> {
  const cutoff = Date.now() - days * 86400 * 1000;
  const out: RawMedia[] = [];
  let next: string | null = `${GRAPH_BASE}/me/media?fields=${MEDIA_FIELDS}&limit=50&access_token=${encodeURIComponent(token)}`;
  for (let page = 0; next && page < 6; page++) {
    const res: { data: RawMedia[]; paging?: { next?: string } } = await fetch(next, { cache: "no-store" }).then((r) =>
      r.json()
    );
    if (!res.data) break;
    let reachedCutoff = false;
    for (const m of res.data) {
      if (Date.parse(m.timestamp) < cutoff) reachedCutoff = true;
      else out.push(m);
    }
    next = reachedCutoff ? null : (res.paging?.next ?? null);
  }
  return out;
}

async function listStories(token: string): Promise<RawMedia[]> {
  const res = await graph<{ data: RawMedia[] }>(token, "me/stories", { fields: MEDIA_FIELDS }).catch(() => ({
    data: [] as RawMedia[],
  }));
  return res.data.map((m) => ({ ...m, media_product_type: "STORY" }));
}

async function mediaInsights(token: string, m: RawMedia) {
  const type = m.media_product_type ?? "FEED";
  const attempts =
    type === "STORY"
      ? ["reach,views,shares,total_interactions,replies", "reach,views"]
      : type === "REELS"
        ? [
            "reach,views,likes,comments,shares,saved,total_interactions,ig_reels_avg_watch_time,ig_reels_video_view_total_time",
            "reach,views,likes,comments,shares,saved,total_interactions",
          ]
        : ["reach,views,likes,comments,shares,saved,total_interactions", "reach,likes,comments,shares,saved,total_interactions"];

  for (const metric of attempts) {
    try {
      const res = await graph<{ data: { name: string; values: { value: number }[] }[] }>(token, `${m.id}/insights`, { metric });
      const v = (name: string) => res.data.find((d) => d.name === name)?.values?.[0]?.value;
      return {
        reach: v("reach") ?? 0,
        views: v("views") ?? 0,
        shares: v("shares") ?? 0,
        saves: v("saved") ?? 0,
        total_interactions: v("total_interactions") ?? 0,
        replies: v("replies") ?? 0,
        avg_watch_time_ms: v("ig_reels_avg_watch_time") ?? null,
        total_watch_time_ms: v("ig_reels_video_view_total_time") ?? null,
        likes: v("likes"),
        comments: v("comments"),
      };
    } catch {
      // tenta a lista de métricas mais enxuta
    }
  }
  return null;
}

async function syncMedia(admin: Admin, token: string, accountId: string, days: number) {
  const [feed, stories] = await Promise.all([listMedia(token, days), listStories(token)]);
  const seen = new Set<string>();
  const items = [...stories, ...feed].filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));

  const rows = await inChunks(items, CONCURRENCY, async (m) => {
    const ins = await mediaInsights(token, m);
    return {
      account_id: accountId,
      media_id: m.id,
      product_type: m.media_product_type ?? "FEED",
      media_type: m.media_type ?? null,
      caption: m.caption ?? null,
      permalink: m.permalink ?? null,
      thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
      posted_at: m.timestamp,
      post_date: brtDate(m.timestamp),
      like_count: ins?.likes ?? m.like_count ?? 0,
      comments_count: ins?.comments ?? m.comments_count ?? 0,
      reach: ins?.reach ?? 0,
      views: ins?.views ?? 0,
      shares: ins?.shares ?? 0,
      saves: ins?.saves ?? 0,
      total_interactions: ins?.total_interactions ?? 0,
      replies: ins?.replies ?? 0,
      avg_watch_time_ms: ins?.avg_watch_time_ms ?? null,
      total_watch_time_ms: ins?.total_watch_time_ms ?? null,
      synced_at: new Date().toISOString(),
    };
  });

  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await admin
      .from("instagram_media")
      .upsert(rows.slice(i, i + 200), { onConflict: "account_id,media_id" });
    if (error) throw error;
  }
  return rows.length;
}

// ── Público e perfil ───────────────────────────────────────────────────────

async function syncAudience(admin: Admin, token: string, accountId: string) {
  const now = new Date().toISOString();
  const rows: { account_id: string; kind: string; data: unknown; synced_at: string }[] = [];

  const profile = await graph<Record<string, unknown>>(token, "me", {
    fields: "username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website",
  });
  rows.push({ account_id: accountId, kind: "profile", data: profile, synced_at: now });

  // A Meta só libera público com 100+ seguidores; o que falhar é ignorado.
  for (const kind of ["age", "gender", "city", "country"]) {
    try {
      const res = await graph<Insights>(token, "me/insights", {
        metric: "follower_demographics",
        period: "lifetime",
        metric_type: "total_value",
        breakdown: kind,
      });
      const data = Object.entries(breakdownMap(res.data[0]))
        .map(([key, value]) => ({ key, value }))
        .sort((a, b) => b.value - a.value);
      if (data.length) rows.push({ account_id: accountId, kind, data, synced_at: now });
    } catch {
      // perfil sem público mínimo
    }
  }

  const { error } = await admin.from("instagram_audience").upsert(rows, { onConflict: "account_id,kind" });
  if (error) throw error;
  return rows.length;
}

// ── Orquestração ───────────────────────────────────────────────────────────

interface AccountResult {
  account: string;
  ok: boolean;
  days?: number;
  media?: number;
  error?: string;
  warnings?: string[];
}

type Progress = (message: string) => Promise<void>;

async function syncAccount(admin: Admin, account: Account, days: number, progress: Progress): Promise<AccountResult> {
  try {
    const { data: tokenRow } = await admin
      .from("instagram_tokens")
      .select("access_token, expires_at")
      .eq("account_id", account.id)
      .maybeSingle();
    if (!tokenRow) return { account: account.label, ok: false, error: "Sem token cadastrado — rode npm run ig-token" };
    await progress(`${account.label}: conectando com o Instagram...`);
    const token = await ensureFreshToken(admin, account.id, tokenRow as TokenRow);

    const warnings: string[] = [];
    const soft = async <T,>(label: string, fn: () => Promise<T>) => {
      try {
        return await fn();
      } catch (err) {
        warnings.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
        return undefined;
      }
    };

    const [dailyCount, mediaCount] = await Promise.all([
      (async () => {
        await progress(`${account.label}: baixando métricas dos últimos ${days} dias...`);
        const n = await syncDaily(admin, token, account.id, days);
        await progress(`${account.label}: ${n} dias de métricas salvos.`);
        return n;
      })(),
      soft("posts", async () => {
        await progress(`${account.label}: buscando posts, reels e stories...`);
        const n = await syncMedia(admin, token, account.id, Math.min(days, 60));
        await progress(`${account.label}: ${n} publicações com métricas salvas.`);
        return n;
      }),
      soft("público", async () => {
        await progress(`${account.label}: atualizando perfil e dados do público...`);
        return syncAudience(admin, token, account.id);
      }),
    ]);
    return { account: account.label, ok: true, days: dailyCount, media: mediaCount, warnings };
  } catch (err) {
    return { account: account.label, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function startRun(admin: Admin) {
  const { data, error } = await admin
    .from("instagram_sync_runs")
    .insert({ status: "running", progress_message: "Iniciando sincronização..." })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function finishRun(admin: Admin, runId: string, results: AccountResult[]) {
  const ok = results.length > 0 && results.every((r) => r.ok);
  const failed = results.filter((r) => !r.ok).map((r) => `${r.account}: ${r.error}`);
  await admin
    .from("instagram_sync_runs")
    .update({
      status: ok ? "success" : "error",
      finished_at: new Date().toISOString(),
      progress_message: ok ? "Sincronização concluída." : `Falhou: ${failed.join(" | ")}`,
    })
    .eq("id", runId);
}

async function runSync(admin: Admin, days: number) {
  const runId = await startRun(admin);
  // Mensagens chegam ao front via Realtime; falha ao gravar não derruba o sync.
  const progress: Progress = async (message) => {
    await admin.from("instagram_sync_runs").update({ progress_message: message }).eq("id", runId);
  };
  try {
    const { data: accounts, error } = await admin
      .from("social_accounts")
      .select("id, label")
      .eq("platform", "instagram")
      .order("sort_order");
    if (error) throw error;
    const results = await Promise.all(((accounts as Account[]) ?? []).map((a) => syncAccount(admin, a, days, progress)));
    await finishRun(admin, runId, results);
    return results;
  } catch (err) {
    await finishRun(admin, runId, [
      { account: "Instagram", ok: false, error: err instanceof Error ? err.message : String(err) },
    ]);
    throw err;
  }
}

function respond(results: AccountResult[]) {
  const ok = results.length > 0 && results.every((r) => r.ok);
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 502 });
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 500 });
  if ((request.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return respond(await runSync(createAdminClient(), 3));
}

export async function POST(request: Request) {
  const { user } = await getCurrentUserAndProfile();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const requested = Number(new URL(request.url).searchParams.get("days"));
  const days = requested >= 1 && requested <= 90 ? requested : 60;
  return respond(await runSync(createAdminClient(), days));
}
