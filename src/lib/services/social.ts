import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialAccount, SocialFollowerSnapshot, SocialLinkClick } from "@/types/database";

export async function listSocialAccounts(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("social_accounts").select("*").order("sort_order");
  if (error) throw error;
  return (data as SocialAccount[]) || [];
}

// Last `days` of snapshots across all accounts — the automated poller writes
// one row every 15 minutes, so this is intraday history, not one-per-day.
// Enough to derive "today vs. yesterday" deltas for the dashboard card.
export async function listRecentFollowerSnapshots(supabase: SupabaseClient, days = 3) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from("social_follower_snapshots")
    .select("*")
    .gte("captured_at", since.toISOString())
    .order("captured_at", { ascending: false });
  if (error) throw error;
  return (data as SocialFollowerSnapshot[]) || [];
}

// All snapshots for one account within [start, end] (inclusive dates,
// "YYYY-MM-DD"), oldest first — used to build the monthly history chart.
export async function listFollowerSnapshotsInRange(
  supabase: SupabaseClient,
  accountId: string,
  start: string,
  end: string
) {
  const { data, error } = await supabase
    .from("social_follower_snapshots")
    .select("*")
    .eq("account_id", accountId)
    .gte("snapshot_date", start)
    .lte("snapshot_date", end)
    .order("captured_at", { ascending: true });
  if (error) throw error;
  return (data as SocialFollowerSnapshot[]) || [];
}

// Last `days` of link clicks across all accounts — mirrors
// listRecentFollowerSnapshots, used to derive "clicks today" on the card.
export async function listRecentLinkClicks(supabase: SupabaseClient, days = 3) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from("social_link_clicks")
    .select("*")
    .gte("clicked_at", since.toISOString())
    .order("clicked_at", { ascending: false });
  if (error) throw error;
  return (data as SocialLinkClick[]) || [];
}

// All link clicks for one account within [start, end] (inclusive dates,
// "YYYY-MM-DD") — used to build the monthly click history chart.
export async function listLinkClicksInRange(
  supabase: SupabaseClient,
  accountId: string,
  start: string,
  end: string
) {
  const { data, error } = await supabase
    .from("social_link_clicks")
    .select("*")
    .eq("account_id", accountId)
    .gte("clicked_at", `${start}T00:00:00.000Z`)
    .lte("clicked_at", `${end}T23:59:59.999Z`)
    .order("clicked_at", { ascending: true });
  if (error) throw error;
  return (data as SocialLinkClick[]) || [];
}

export async function addFollowerSnapshot(
  supabase: SupabaseClient,
  input: { account_id: string; followers_count: number; media_count?: number | null; created_by?: string | null; source?: string }
) {
  const { data, error } = await supabase
    .from("social_follower_snapshots")
    .insert({ ...input, captured_at: new Date().toISOString() })
    .select("*")
    .single();
  if (error) throw error;
  return data as SocialFollowerSnapshot;
}
