import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkAnniversary, WorkAnniversaryPhoto } from "@/types/database";

export async function listWorkAnniversaries(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("work_anniversaries").select("*").order("name");
  if (error) throw error;
  return data as WorkAnniversary[];
}

export async function createWorkAnniversary(
  supabase: SupabaseClient,
  userId: string,
  input: { name: string; hire_date: string; notes?: string | null }
) {
  const { data, error } = await supabase
    .from("work_anniversaries")
    .insert({ ...input, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data as WorkAnniversary;
}

export async function updateWorkAnniversary(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<WorkAnniversary>
) {
  const { data, error } = await supabase
    .from("work_anniversaries")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as WorkAnniversary;
}

export async function deleteWorkAnniversary(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("work_anniversaries").delete().eq("id", id);
  if (error) throw error;
}

export async function listWorkAnniversaryPhotos(supabase: SupabaseClient, workAnniversaryId?: string) {
  let query = supabase.from("work_anniversary_photos").select("*").order("created_at", { ascending: false });
  if (workAnniversaryId) query = query.eq("work_anniversary_id", workAnniversaryId);
  const { data, error } = await query;
  if (error) throw error;
  return data as WorkAnniversaryPhoto[];
}

export async function uploadWorkAnniversaryPhoto(
  supabase: SupabaseClient,
  workAnniversaryId: string,
  userId: string,
  file: File
) {
  const path = `work/${workAnniversaryId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("birthday-photos").upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("work_anniversary_photos")
    .insert({
      work_anniversary_id: workAnniversaryId,
      uploaded_by: userId,
      file_name: file.name,
      file_path: path,
      file_type: file.type,
      file_size: file.size,
    })
    .select()
    .single();
  if (error) throw error;
  return data as WorkAnniversaryPhoto;
}

export async function getWorkAnniversaryPhotoUrl(supabase: SupabaseClient, path: string, downloadName?: string) {
  const { data, error } = await supabase
    .storage
    .from("birthday-photos")
    .createSignedUrl(path, 3600, downloadName ? { download: downloadName } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteWorkAnniversaryPhoto(supabase: SupabaseClient, id: string, path: string) {
  await supabase.storage.from("birthday-photos").remove([path]);
  const { error } = await supabase.from("work_anniversary_photos").delete().eq("id", id);
  if (error) throw error;
}
