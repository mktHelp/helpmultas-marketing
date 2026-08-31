import type { SupabaseClient } from "@supabase/supabase-js";
import type { BirthdayPhoto, Profile } from "@/types/database";

export async function listBirthdayProfiles(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_active", true)
    .not("birth_date", "is", null)
    .order("full_name");
  if (error) throw error;
  return data as Profile[];
}

export async function listBirthdayPhotos(supabase: SupabaseClient, profileId?: string) {
  let query = supabase.from("birthday_photos").select("*").order("created_at", { ascending: false });
  if (profileId) query = query.eq("profile_id", profileId);
  const { data, error } = await query;
  if (error) throw error;
  return data as BirthdayPhoto[];
}

export async function uploadBirthdayPhoto(
  supabase: SupabaseClient,
  profileId: string,
  userId: string,
  file: File
) {
  const path = `${profileId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("birthday-photos").upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("birthday_photos")
    .insert({
      profile_id: profileId,
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
