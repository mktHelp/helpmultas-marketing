import type { SupabaseClient } from "@supabase/supabase-js";
import type { InstagramAudienceRow, InstagramDailyInsight, InstagramMedia } from "@/types/database";

// Janela buscada no servidor: 2x o maior período do seletor (60 dias), pra
// poder comparar cada período com o anterior.
export const INSTAGRAM_HISTORY_DAYS = 130;

function sinceDate(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since.toISOString().slice(0, 10);
}

export async function listInstagramInsights(supabase: SupabaseClient, days = INSTAGRAM_HISTORY_DAYS) {
  const { data, error } = await supabase
    .from("instagram_daily_insights")
    .select("*")
    .gte("date", sinceDate(days))
    .order("date", { ascending: true });
  if (error) throw error;
  return (data as InstagramDailyInsight[]) || [];
}

export async function listInstagramMedia(supabase: SupabaseClient, days = INSTAGRAM_HISTORY_DAYS) {
  const { data, error } = await supabase
    .from("instagram_media")
    .select("*")
    .gte("post_date", sinceDate(days))
    .order("posted_at", { ascending: false });
  if (error) throw error;
  return (data as InstagramMedia[]) || [];
}

export async function listInstagramAudience(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("instagram_audience").select("*");
  if (error) throw error;
  return (data as InstagramAudienceRow[]) || [];
}

// ── Categorias de conteúdo ─────────────────────────────────────────────────
// A Graph API usa nomes diferentes nas métricas diárias (REEL, POST,
// CAROUSEL_CONTAINER...) e nos posts (REELS, FEED + CAROUSEL_ALBUM); aqui
// tudo vira uma das mesmas categorias.

export type ContentCategory = "reels" | "post" | "carousel" | "story" | "ad" | "other";

export const CATEGORY_ORDER: ContentCategory[] = ["reels", "post", "carousel", "story", "ad", "other"];

export const CATEGORY_LABEL: Record<ContentCategory, string> = {
  reels: "Reels",
  post: "Posts",
  carousel: "Carrosséis",
  story: "Stories",
  ad: "Anúncios",
  other: "Outros",
};

export const CATEGORY_COLOR: Record<ContentCategory, string> = {
  reels: "#243746",
  post: "#5b7fa6",
  carousel: "#2f8f5b",
  story: "#fcbf00",
  ad: "#c23b3b",
  other: "#9aa7af",
};

export function categoryFromDailyKey(key: string): ContentCategory {
  const k = key.toUpperCase();
  if (k.startsWith("REEL")) return "reels";
  if (k.startsWith("CAROUSEL")) return "carousel";
  if (k === "POST" || k === "FEED" || k === "IMAGE" || k === "VIDEO") return "post";
  if (k.startsWith("STORY")) return "story";
  if (k === "AD") return "ad";
  return "other";
}

export function categoryFromMedia(m: Pick<InstagramMedia, "product_type" | "media_type">): ContentCategory {
  const p = m.product_type.toUpperCase();
  if (p === "REELS" || p === "REEL") return "reels";
  if (p === "STORY") return "story";
  if (p === "AD") return "ad";
  if (m.media_type === "CAROUSEL_ALBUM") return "carousel";
  return "post";
}

export function sumByCategory(rows: Record<string, number>[]): Partial<Record<ContentCategory, number>> {
  const out: Partial<Record<ContentCategory, number>> = {};
  for (const r of rows) {
    for (const [k, v] of Object.entries(r || {})) {
      const cat = categoryFromDailyKey(k);
      out[cat] = (out[cat] ?? 0) + v;
    }
  }
  return out;
}

// ── Agregações ─────────────────────────────────────────────────────────────

export interface InstagramTotals {
  views: number;
  viewsFollowers: number;
  viewsNonFollowers: number;
  reach: number;
  reachFollowers: number;
  reachNonFollowers: number;
  accountsEngaged: number;
  interactions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  replies: number;
  reposts: number;
  profileViews: number;
  websiteClicks: number;
  netFollowers: number;
  viewsByCategory: Partial<Record<ContentCategory, number>>;
  reachByCategory: Partial<Record<ContentCategory, number>>;
  interactionsByCategory: Partial<Record<ContentCategory, number>>;
}

export function sumInsights(rows: InstagramDailyInsight[]): InstagramTotals {
  const t: InstagramTotals = {
    views: 0, viewsFollowers: 0, viewsNonFollowers: 0, reach: 0, reachFollowers: 0, reachNonFollowers: 0,
    accountsEngaged: 0, interactions: 0, likes: 0, comments: 0, shares: 0, saves: 0, replies: 0, reposts: 0,
    profileViews: 0, websiteClicks: 0, netFollowers: 0, viewsByCategory: {}, reachByCategory: {}, interactionsByCategory: {},
  };
  for (const r of rows) {
    t.views += r.views;
    t.viewsFollowers += r.views_followers;
    t.viewsNonFollowers += r.views_non_followers;
    t.reach += r.reach;
    t.reachFollowers += r.reach_followers ?? 0;
    t.reachNonFollowers += r.reach_non_followers ?? 0;
    t.accountsEngaged += r.accounts_engaged;
    t.interactions += r.total_interactions;
    t.likes += r.likes;
    t.comments += r.comments;
    t.shares += r.shares;
    t.saves += r.saves;
    t.replies += r.replies ?? 0;
    t.reposts += r.reposts ?? 0;
    t.profileViews += r.profile_views;
    t.websiteClicks += r.website_clicks;
    t.netFollowers += r.net_followers;
  }
  t.viewsByCategory = sumByCategory(rows.map((r) => r.views_by_type));
  t.reachByCategory = sumByCategory(rows.map((r) => r.reach_by_type ?? {}));
  t.interactionsByCategory = sumByCategory(rows.map((r) => r.interactions_by_type ?? {}));
  return t;
}

export interface PeriodSlices {
  current: InstagramDailyInsight[];
  previous: InstagramDailyInsight[];
  // Primeiro dia (YYYY-MM-DD) do período atual — usado pra filtrar posts.
  since: string;
  hasPrevious: boolean;
}

function shiftDate(date: string, delta: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Período = últimos N dias sincronizados; anterior = os N dias antes disso.
export function sliceByPeriod(rows: InstagramDailyInsight[], days: number): PeriodSlices {
  if (rows.length === 0) return { current: [], previous: [], since: "", hasPrevious: false };
  const last = rows[rows.length - 1].date;
  const since = shiftDate(last, -(days - 1));
  const prevSince = shiftDate(since, -days);
  const current = rows.filter((r) => r.date >= since);
  const previous = rows.filter((r) => r.date >= prevSince && r.date < since);
  return { current, previous, since, hasPrevious: previous.length >= Math.ceil(days / 2) };
}

export function weekdayOf(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const WEEKDAY_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function engagementRate(interactions: number, reach: number) {
  return reach > 0 ? (interactions / reach) * 100 : 0;
}
