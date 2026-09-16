import type { SupabaseClient } from "@supabase/supabase-js";
import type { TeleprompterScript } from "@/types/database";

export async function listTeleprompterScripts(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("teleprompter_scripts")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data as TeleprompterScript[];
}

export async function createTeleprompterScript(
  supabase: SupabaseClient,
  userId: string,
  input: { title: string; content: string }
) {
  const { data, error } = await supabase
    .from("teleprompter_scripts")
    .insert({ ...input, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data as TeleprompterScript;
}

export async function updateTeleprompterScript(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Pick<TeleprompterScript, "title" | "content">>
) {
  const { data, error } = await supabase
    .from("teleprompter_scripts")
    .update(patch)
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
