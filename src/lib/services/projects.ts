import type { SupabaseClient } from "@supabase/supabase-js";
import type { Campaign, Profile, Project } from "@/types/database";

export type Owner = Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
export type ProjectWithOwner = Project & { owner: Owner };
export type CampaignWithOwner = Campaign & { owner: Owner };

const PROJECT_SELECT = `*, owner:profiles(id, full_name, avatar_url)`;

export async function listProjects(supabase: SupabaseClient, includeArchived = false) {
  let query = supabase.from("projects").select(PROJECT_SELECT).order("created_at", { ascending: false });
  if (!includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query;
  if (error) throw error;
  return data as ProjectWithOwner[];
}

export async function getProject(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("projects").select(PROJECT_SELECT).eq("id", id).single();
  if (error) throw error;
  return data as ProjectWithOwner;
}

export async function createProject(supabase: SupabaseClient, input: Partial<Project>) {
  const { data, error } = await supabase.from("projects").insert(input).select().single();
  if (error) throw error;
  return data as Project;
}

export async function updateProject(supabase: SupabaseClient, id: string, patch: Partial<Project>) {
  const { data, error } = await supabase.from("projects").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as Project;
}

export async function deleteProject(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

const CAMPAIGN_SELECT = `*, owner:profiles(id, full_name, avatar_url)`;

export async function listCampaigns(supabase: SupabaseClient, includeArchived = false) {
  let query = supabase.from("campaigns").select(CAMPAIGN_SELECT).order("created_at", { ascending: false });
  if (!includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query;
  if (error) throw error;
  return data as CampaignWithOwner[];
}

export async function getCampaign(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("campaigns").select(CAMPAIGN_SELECT).eq("id", id).single();
  if (error) throw error;
  return data as CampaignWithOwner;
}

export async function createCampaign(supabase: SupabaseClient, input: Partial<Campaign>) {
  const { data, error } = await supabase.from("campaigns").insert(input).select().single();
  if (error) throw error;
  return data as Campaign;
}

export async function updateCampaign(supabase: SupabaseClient, id: string, patch: Partial<Campaign>) {
  const { data, error } = await supabase.from("campaigns").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as Campaign;
}

export async function deleteCampaign(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) throw error;
}
