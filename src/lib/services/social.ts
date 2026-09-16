import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialAccount, SocialFollowerSnapshot } from "@/types/database";

export async function listSocialAccounts(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("social_accounts").select("*").order("sort_order");
  if (error) throw error;
  return (data as SocialAccount[]) || [];
}

// Last `days` of snapshots across all accounts — enough to derive
// yesterday-vs-today deltas for the dashboard card.
export async function listRecentFollowerSnapshots(supabase: SupabaseClient, days = 14) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from("social_follower_snapshots")
    .select("*")
    .gte("snapshot_date", since.toISOString().slice(0, 10))
    .order("snapshot_date", { ascending: false });
  if (error) throw error;
  return (data as SocialFollowerSnapshot[]) || [];
}

export async function upsertFollowerSnapshot(
  supabase: SupabaseClient,
  input: { account_id: string; snapshot_date: string; followers_count: number; created_by: string; source?: string }
) {
  const { data, error } = await supabase
    .from("social_follower_snapshots")
    .upsert(input, { onConflict: "account_id,snapshot_date" })
    .select("*")
    .single();
  if (error) throw error;
  return data as SocialFollowerSnapshot;
}
