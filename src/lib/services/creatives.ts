import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectCreative } from "@/types/database";

const CREATIVE_SELECT = `*, deliverer:profiles!project_creatives_delivered_by_fkey(id, full_name, avatar_url)`;

export async function listProjectCreatives(supabase: SupabaseClient, projectId: string) {
  const { data, error } = await supabase
    .from("project_creatives")
    .select(CREATIVE_SELECT)
    .eq("project_id", projectId)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return data as ProjectCreative[];
}

export async function createProjectCreative(supabase: SupabaseClient, input: Partial<ProjectCreative>) {
  const { data, error } = await supabase.from("project_creatives").insert(input).select(CREATIVE_SELECT).single();
  if (error) throw error;
  return data as ProjectCreative;
}

export async function updateProjectCreative(supabase: SupabaseClient, id: string, patch: Partial<ProjectCreative>) {
  const { data, error } = await supabase
    .from("project_creatives")
    .update(patch)
    .eq("id", id)
    .select(CREATIVE_SELECT)
    .single();
  if (error) throw error;
  return data as ProjectCreative;
}

export async function deleteProjectCreative(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("project_creatives").delete().eq("id", id);
  if (error) throw error;
}
