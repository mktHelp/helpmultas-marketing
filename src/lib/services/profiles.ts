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

export const AVATAR_BUCKET = "avatars";
export const AVATAR_MAX_INPUT_BYTES = 10 * 1024 * 1024;
const AVATAR_SIZE = 512;

// Recorta o centro em quadrado, reduz pra 512px e re-encoda em JPEG: foto de
// celular de 6 MB vira ~60 KB, e o formato final é sempre suportado.
async function prepareAvatar(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem (JPG, PNG, WEBP ou GIF).");
  if (file.size > AVATAR_MAX_INPUT_BYTES) throw new Error("A imagem é muito grande (máximo 10 MB).");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Não consegui ler essa imagem. Tente um JPG ou PNG.");
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu processar a imagem.");
  ctx.fillStyle = "#ffffff"; // PNG transparente não vira fundo preto no JPEG
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) throw new Error("Não foi possível processar a imagem.");
  return blob;
}

async function removeOldAvatars(supabase: SupabaseClient, userId: string, keep?: string) {
  const { data } = await supabase.storage.from(AVATAR_BUCKET).list(userId);
  const stale = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (stale.length > 0) await supabase.storage.from(AVATAR_BUCKET).remove(stale);
}

export async function uploadAvatar(supabase: SupabaseClient, userId: string, file: File) {
  const blob = await prepareAvatar(file);
  // Nome novo a cada troca: evita cache antigo do navegador/CDN.
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (uploadError) throw new Error("Não foi possível enviar a foto. Tente novamente.");

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  try {
    const profile = await updateProfile(supabase, userId, { avatar_url: data.publicUrl });
    await removeOldAvatars(supabase, userId, path).catch(() => {});
    return profile;
  } catch {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]).catch(() => {});
    throw new Error("A foto foi enviada, mas não consegui salvá-la no seu perfil.");
  }
}

export async function removeAvatar(supabase: SupabaseClient, userId: string) {
  const profile = await updateProfile(supabase, userId, { avatar_url: null });
  await removeOldAvatars(supabase, userId).catch(() => {});
  return profile;
}
