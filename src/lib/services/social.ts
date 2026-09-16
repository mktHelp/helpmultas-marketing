import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialAccount, SocialFollowerSnapshot } from "@/types/database";

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
