import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

export async function listProfiles(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_active", true)
    .neq("role", "expansao") // expansion accounts aren't team members (pickers, rankings, etc.)
    .order("full_name");
  if (error) throw error;
  return data as Profile[];
}

export async function listAllProfiles(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("profiles").select("*").order("full_name");
  if (error) throw error;
  return data as Profile[];
}

export async function getProfile(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Profile;
}

export async function updateProfile(supabase: SupabaseClient, id: string, patch: Partial<Profile>) {
  const { data, error } = await supabase.from("profiles").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as Profile;
}
