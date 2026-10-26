import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExpansionDoc, ExpansionFolder, ExpansionMeetingLink } from "@/types/database";

// ------------------------- Links de reuniões (Drive) -------------------------

export type MeetingLinkInput = { title: string; url: string; meeting_date: string | null; notes: string | null };

export async function listMeetingLinks(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("expansion_meeting_links")
    .select("*")
    .order("meeting_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ExpansionMeetingLink[];
}

export async function createMeetingLink(supabase: SupabaseClient, userId: string, input: MeetingLinkInput) {
  const { data, error } = await supabase.from("expansion_meeting_links").insert({ ...input, created_by: userId }).select().single();
  if (error) throw error;
  return data as ExpansionMeetingLink;
}

export async function updateMeetingLink(supabase: SupabaseClient, id: string, patch: Partial<MeetingLinkInput>) {
  const { data, error } = await supabase.from("expansion_meeting_links").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as ExpansionMeetingLink;
}

export async function deleteMeetingLink(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("expansion_meeting_links").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Converte um link do Drive/Docs em uma URL que pode ser embutida num iframe.
 * Retorna null quando não dá para embutir (outros sites) — aí só resta o botão de abrir.
 */
export function drivePreviewUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname;
  if (host === "drive.google.com") {
    const folder = u.pathname.match(/\/folders\/([\w-]+)/);
    if (folder) return `https://drive.google.com/embeddedfolderview?id=${folder[1]}#list`;
    const file = u.pathname.match(/\/file\/d\/([\w-]+)/);
    const id = file?.[1] ?? u.searchParams.get("id");
    return id ? `https://drive.google.com/file/d/${id}/preview` : null;
  }
  if (host === "docs.google.com") {
    const m = u.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([\w-]+)/);
    return m ? `https://docs.google.com/${m[1]}/d/${m[2]}/preview` : null;
  }
  return null;
}

// ------------------------- Pastas e documentos -------------------------

export async function listExpansionFolders(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("expansion_folders").select("*").order("name");
  if (error) throw error;
  return data as ExpansionFolder[];
}

export async function createExpansionFolder(supabase: SupabaseClient, userId: string, input: { name: string; color: string }) {
  const { data, error } = await supabase.from("expansion_folders").insert({ ...input, created_by: userId }).select().single();
  if (error) throw error;
  return data as ExpansionFolder;
}

export async function updateExpansionFolder(supabase: SupabaseClient, id: string, patch: Partial<Pick<ExpansionFolder, "name" | "color">>) {
  const { data, error } = await supabase.from("expansion_folders").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as ExpansionFolder;
}

export async function deleteExpansionFolder(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("expansion_folders").delete().eq("id", id);
  if (error) throw error;
}

export type DocInput = { folder_id: string; kind: ExpansionDoc["kind"]; title: string; content: string };

export async function listExpansionDocs(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("expansion_docs").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return data as ExpansionDoc[];
}

export async function createExpansionDoc(supabase: SupabaseClient, userId: string, input: DocInput) {
  const { data, error } = await supabase.from("expansion_docs").insert({ ...input, created_by: userId }).select().single();
  if (error) throw error;
  return data as ExpansionDoc;
}

export async function updateExpansionDoc(supabase: SupabaseClient, id: string, patch: Partial<DocInput>) {
  const { data, error } = await supabase
    .from("expansion_docs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ExpansionDoc;
}

export async function deleteExpansionDoc(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("expansion_docs").delete().eq("id", id);
  if (error) throw error;
}
