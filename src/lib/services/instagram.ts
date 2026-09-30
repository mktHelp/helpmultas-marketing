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

// ── Períodos ───────────────────────────────────────────────────────────────
// Helpers de período moram em lib/period.ts (compartilhados com o Tráfego Pago).
export * from "@/lib/period";
import { rangeLength, shiftDate, todayBRT, type DateRange } from "@/lib/period";

export interface PeriodSlices {
  current: InstagramDailyInsight[];
  previous: InstagramDailyInsight[];
  range: DateRange;
  // Mesmo tamanho do período, imediatamente antes dele.
  prevRange: DateRange;
  hasPrevious: boolean;
}

export function sliceByRange(rows: InstagramDailyInsight[], range: DateRange): PeriodSlices {
  const length = rangeLength(range);
  const prevRange = { from: shiftDate(range.from, -length), to: shiftDate(range.from, -1) };
  const current = rows.filter((r) => r.date >= range.from && r.date <= range.to);
  const previous = rows.filter((r) => r.date >= prevRange.from && r.date <= prevRange.to);
  // Período que inclui hoje é parcial: compará-lo com dias fechados engana.
  const closed = range.to < todayBRT();
  return { current, previous, range, prevRange, hasPrevious: closed && previous.length >= Math.ceil(length / 2) };
}

export function mediaInRange<T extends { post_date: string }>(media: T[], range: DateRange): T[] {
  return media.filter((m) => m.post_date >= range.from && m.post_date <= range.to);
}

export function weekdayOf(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const WEEKDAY_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function engagementRate(interactions: number, reach: number) {
  return reach > 0 ? (interactions / reach) * 100 : 0;
}
