import type { SupabaseClient } from "@supabase/supabase-js";
import type { InstagramDailyInsight } from "@/types/database";

export async function listInstagramInsights(supabase: SupabaseClient, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from("instagram_daily_insights")
    .select("*")
    .gte("date", since.toISOString().slice(0, 10))
    .order("date", { ascending: true });
  if (error) throw error;
  return (data as InstagramDailyInsight[]) || [];
}

export interface InstagramTotals {
  views: number;
  viewsFollowers: number;
  viewsNonFollowers: number;
  viewsByType: Record<string, number>;
  reach: number;
  accountsEngaged: number;
  interactions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  profileViews: number;
  websiteClicks: number;
  netFollowers: number;
}

export function sumInsights(rows: InstagramDailyInsight[]): InstagramTotals {
  const t: InstagramTotals = {
    views: 0, viewsFollowers: 0, viewsNonFollowers: 0, viewsByType: {}, reach: 0, accountsEngaged: 0,
    interactions: 0, likes: 0, comments: 0, shares: 0, saves: 0, profileViews: 0, websiteClicks: 0, netFollowers: 0,
  };
  for (const r of rows) {
    t.views += r.views;
    t.viewsFollowers += r.views_followers;
    t.viewsNonFollowers += r.views_non_followers;
    for (const [k, v] of Object.entries(r.views_by_type || {})) t.viewsByType[k] = (t.viewsByType[k] ?? 0) + v;
    t.reach += r.reach;
    t.accountsEngaged += r.accounts_engaged;
    t.interactions += r.total_interactions;
    t.likes += r.likes;
    t.comments += r.comments;
    t.shares += r.shares;
    t.saves += r.saves;
    t.profileViews += r.profile_views;
    t.websiteClicks += r.website_clicks;
    t.netFollowers += r.net_followers;
  }
  return t;
}
