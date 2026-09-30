import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";

// Sync somente-leitura dos Insights do Instagram (Graph API) para
// instagram_daily_insights, um registro por perfil por dia. Dois gatilhos,
// mesmo padrão de api/meta-ads/sync:
//   GET  — Vercel Cron (vercel.json), autenticado com CRON_SECRET; reprocessa
//          os últimos 3 dias (a Meta ainda ajusta os números do dia anterior).
//   POST — botão "Atualizar" da aba Instagram, sessão de usuário; puxa 30 dias.
//
// Token: INSTAGRAM_ACCESS_TOKEN, ou META_SYSTEM_USER_TOKEN como fallback. Precisa
// de instagram_basic + instagram_manage_insights + pages_show_list, e as
// Páginas/perfis precisam estar atribuídos ao usuário do sistema no Business.
//
// Dias são fechados no fuso de São Paulo (UTC-3).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GRAPH_BASE = "https://graph.facebook.com/v21.0";
const CONCURRENCY = 6;
const BRT_OFFSET_SECONDS = 3 * 3600;

type Admin = ReturnType<typeof createAdminClient>;

interface Account {
  id: string;
  label: string;
  ig_username: string | null;
  ig_user_id: string | null;
}

interface InsightMetric {
  name: string;
  total_value?: {
    value?: number;
    breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[];
  };
  values?: { value: number; end_time: string }[];
}

class GraphApiError extends Error {}

function getToken(): string {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_SYSTEM_USER_TOKEN;
  if (!token) throw new GraphApiError("INSTAGRAM_ACCESS_TOKEN não configurado");
  return token;
}

async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ ...params, access_token: getToken() });
  const res = await fetch(`${GRAPH_BASE}/${path}?${qs}`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new GraphApiError(json.error?.message || `Graph API ${res.status}`);
  }
  return json as T;
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

async function resolveIgUserId(account: Account): Promise<string | null> {
  if (account.ig_user_id) return account.ig_user_id;
  if (!account.ig_username) return null;
  const pages = await graph<{
    data: { instagram_business_account?: { id: string; username: string } }[];
  }>("me/accounts", { fields: "instagram_business_account{id,username}", limit: "100" });
  const wanted = account.ig_username.toLowerCase();
  const match = pages.data
    .map((p) => p.instagram_business_account)
    .find((ig) => ig?.username?.toLowerCase() === wanted);
  return match?.id ?? null;
}

function breakdownMap(metric: InsightMetric | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of metric?.total_value?.breakdowns?.[0]?.results ?? []) {
    out[r.dimension_values[0]] = r.value;
  }
  return out;
}

async function fetchDay(igUserId: string, date: string) {
  const { since, until } = dayRange(date);
  const base = { since, until, metric_type: "total_value" };

  const [totals, byType, byFollow] = await Promise.all([
    graph<{ data: InsightMetric[] }>(`${igUserId}/insights`, {
      ...base,
      metric: "views,reach,accounts_engaged,total_interactions,likes,comments,shares,saves,profile_views,website_clicks",
    }),
    graph<{ data: InsightMetric[] }>(`${igUserId}/insights`, { ...base, metric: "views", breakdown: "media_product_type" }),
    graph<{ data: InsightMetric[] }>(`${igUserId}/insights`, { ...base, metric: "views", breakdown: "follow_type" }),
  ]);

  const value = (name: string) => totals.data.find((m) => m.name === name)?.total_value?.value ?? 0;
  const follow = breakdownMap(byFollow.data[0]);

  return {
    date,
    views: value("views"),
    views_followers: follow.FOLLOWER ?? 0,
    views_non_followers: follow.NON_FOLLOWER ?? 0,
    views_by_type: breakdownMap(byType.data[0]),
    reach: value("reach"),
    accounts_engaged: value("accounts_engaged"),
    total_interactions: value("total_interactions"),
    likes: value("likes"),
    comments: value("comments"),
    shares: value("shares"),
    saves: value("saves"),
    profile_views: value("profile_views"),
    website_clicks: value("website_clicks"),
  };
}

// follower_count vem em série diária (ganho líquido de seguidores por dia),
// só nos últimos 30 dias — uma chamada cobre o período todo.
async function fetchNetFollowers(igUserId: string, days: number): Promise<Record<string, number>> {
  const dates = lastDates(Math.min(days, 30));
  const { since } = dayRange(dates[0]);
  const { until } = dayRange(dates[dates.length - 1]);
  const res = await graph<{ data: InsightMetric[] }>(`${igUserId}/insights`, {
    metric: "follower_count",
    period: "day",
    since,
    until,
  });
  const out: Record<string, number> = {};
  for (const v of res.data[0]?.values ?? []) {
    // end_time marca o fim do dia (00:00 de D+1); o dia em si é o anterior.
    const day = new Date(Date.parse(v.end_time) - BRT_OFFSET_SECONDS * 1000 - 86400 * 1000);
    out[day.toISOString().slice(0, 10)] = v.value;
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

async function runSync(admin: Admin, days: number) {
  const { data: accounts, error } = await admin
    .from("social_accounts")
    .select("id, label, ig_username, ig_user_id")
    .eq("platform", "instagram")
    .order("sort_order");
  if (error) throw error;

  const results: { account: string; ok: boolean; days?: number; error?: string }[] = [];

  for (const account of (accounts as Account[]) ?? []) {
    try {
      const igUserId = await resolveIgUserId(account);
      if (!igUserId) {
        results.push({
          account: account.label,
          ok: false,
          error: "Perfil não encontrado na Meta — defina ig_username/ig_user_id e atribua o perfil ao token",
        });
        continue;
      }
      if (igUserId !== account.ig_user_id) {
        await admin.from("social_accounts").update({ ig_user_id: igUserId }).eq("id", account.id);
      }

      const rows = await inChunks(lastDates(days), CONCURRENCY, (d) => fetchDay(igUserId, d));
      const net = await fetchNetFollowers(igUserId, days).catch(() => ({}) as Record<string, number>);

      const { error: upsertError } = await admin.from("instagram_daily_insights").upsert(
        rows.map((r) => ({
          ...r,
          account_id: account.id,
          net_followers: net[r.date] ?? 0,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: "account_id,date" }
      );
      if (upsertError) throw upsertError;
      results.push({ account: account.label, ok: true, days: rows.length });
    } catch (err) {
      results.push({ account: account.label, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}

function respond(results: Awaited<ReturnType<typeof runSync>>) {
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

export async function POST() {
  const { user } = await getCurrentUserAndProfile();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  return respond(await runSync(createAdminClient(), 30));
}
