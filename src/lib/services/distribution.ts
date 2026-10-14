import type { SupabaseClient } from "@supabase/supabase-js";
import type { DistributionPost } from "@/types/database";

export async function listDistributionPosts(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("distribution_posts").select("*").order("sort_order").order("created_at");
  if (error) throw error;
  return data as DistributionPost[];
}

export async function createDistributionPost(supabase: SupabaseClient, input: Partial<DistributionPost>) {
  const { data, error } = await supabase.from("distribution_posts").insert(input).select("*").single();
  if (error) throw error;
  return data as DistributionPost;
}

export async function updateDistributionPost(supabase: SupabaseClient, id: string, patch: Partial<DistributionPost>) {
  const { data, error } = await supabase
    .from("distribution_posts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as DistributionPost;
}

export async function deleteDistributionPost(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("distribution_posts").delete().eq("id", id);
  if (error) throw error;
}
