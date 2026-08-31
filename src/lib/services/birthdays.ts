import type { SupabaseClient } from "@supabase/supabase-js";
import type { Birthday, BirthdayPhoto } from "@/types/database";

export async function listBirthdays(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("birthdays").select("*").order("name");
  if (error) throw error;
  return data as Birthday[];
}

export async function createBirthday(
  supabase: SupabaseClient,
  userId: string,
  input: { name: string; birth_month: number; birth_day: number; notes?: string | null }
) {
  const { data, error } = await supabase
    .from("birthdays")
    .insert({ ...input, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Birthday;
}

export async function updateBirthday(supabase: SupabaseClient, id: string, patch: Partial<Birthday>) {
  const { data, error } = await supabase.from("birthdays").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as Birthday;
}

export async function deleteBirthday(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("birthdays").delete().eq("id", id);
  if (error) throw error;
}

export async function listBirthdayPhotos(supabase: SupabaseClient, birthdayId?: string) {
  let query = supabase.from("birthday_photos").select("*").order("created_at", { ascending: false });
  if (birthdayId) query = query.eq("birthday_id", birthdayId);
  const { data, error } = await query;
  if (error) throw error;
  return data as BirthdayPhoto[];
}

export async function uploadBirthdayPhoto(
  supabase: SupabaseClient,
  birthdayId: string,
  userId: string,
  file: File
) {
  const path = `${birthdayId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("birthday-photos").upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("birthday_photos")
    .insert({
      birthday_id: birthdayId,
      uploaded_by: userId,
      file_name: file.name,
      file_path: path,
      file_type: file.type,
      file_size: file.size,
    })
    .select()
    .single();
  if (error) throw error;
  return data as BirthdayPhoto;
}

export async function getBirthdayPhotoUrl(supabase: SupabaseClient, path: string) {
  const { data, error } = await supabase.storage.from("birthday-photos").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteBirthdayPhoto(supabase: SupabaseClient, id: string, path: string) {
  await supabase.storage.from("birthday-photos").remove([path]);
  const { error } = await supabase.from("birthday_photos").delete().eq("id", id);
  if (error) throw error;
}
