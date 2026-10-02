import type { SupabaseClient } from "@supabase/supabase-js";
import type { TeleprompterFolder, TeleprompterScript } from "@/types/database";

export type ScriptInput = {
  title: string;
  content: string;
  content_html: string | null;
  folder_id: string | null;
  record_date: string | null;
};

export async function listTeleprompterScripts(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("teleprompter_scripts")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data as TeleprompterScript[];
}

export async function createTeleprompterScript(supabase: SupabaseClient, userId: string, input: ScriptInput) {
  const { data, error } = await supabase
    .from("teleprompter_scripts")
    .insert({ ...input, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data as TeleprompterScript;
}

export async function updateTeleprompterScript(supabase: SupabaseClient, id: string, patch: Partial<ScriptInput>) {
  const { data, error } = await supabase
    .from("teleprompter_scripts")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as TeleprompterScript;
}

/** Marca/desmarca o check de "gravado" (e registra quando foi marcado). */
export async function setTeleprompterRecorded(supabase: SupabaseClient, id: string, recorded: boolean) {
  const { data, error } = await supabase
    .from("teleprompter_scripts")
    .update({ is_recorded: recorded, recorded_at: recorded ? new Date().toISOString() : null })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as TeleprompterScript;
}

export async function deleteTeleprompterScript(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("teleprompter_scripts").delete().eq("id", id);
  if (error) throw error;
}

// ------------------------- Pastas -------------------------

export async function listTeleprompterFolders(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("teleprompter_folders").select("*").order("name");
  if (error) throw error;
  return data as TeleprompterFolder[];
}

export async function createTeleprompterFolder(supabase: SupabaseClient, userId: string, input: { name: string; color: string }) {
  const { data, error } = await supabase
    .from("teleprompter_folders")
    .insert({ ...input, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data as TeleprompterFolder;
}

export async function updateTeleprompterFolder(supabase: SupabaseClient, id: string, patch: Partial<Pick<TeleprompterFolder, "name" | "color">>) {
  const { data, error } = await supabase.from("teleprompter_folders").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as TeleprompterFolder;
}

export async function deleteTeleprompterFolder(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("teleprompter_folders").delete().eq("id", id);
  if (error) throw error;
}
