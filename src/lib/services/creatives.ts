import type { SupabaseClient } from "@supabase/supabase-js";
import type { Creative } from "@/types/database";

const CREATIVE_SELECT = `*, deliverer:profiles!creatives_delivered_by_fkey(id, full_name, avatar_url)`;

export async function listCreatives(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("creatives")
    .select(CREATIVE_SELECT)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return data as Creative[];
}

export async function createCreative(supabase: SupabaseClient, input: Partial<Creative>) {
  const { data, error } = await supabase.from("creatives").insert(input).select(CREATIVE_SELECT).single();
  if (error) throw error;
  return data as Creative;
}

export async function updateCreative(supabase: SupabaseClient, id: string, patch: Partial<Creative>) {
  const { data, error } = await supabase
    .from("creatives")
    .update(patch)
    .eq("id", id)
    .select(CREATIVE_SELECT)
    .single();
  if (error) throw error;
  return data as Creative;
}

export async function deleteCreative(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("creatives").delete().eq("id", id);
  if (error) throw error;
}
