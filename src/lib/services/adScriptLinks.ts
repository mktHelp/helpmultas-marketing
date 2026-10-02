import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdScriptLink {
  adId: string;
  scriptId: string;
}

/** Vínculos de uma lista de anúncios -> roteiro (com título). Devolve vazio se a tabela ainda não existe. */
export async function fetchScriptsForAds(supabase: SupabaseClient, adIds: string[]) {
  const map = new Map<string, { scriptId: string; title: string }>();
  if (adIds.length === 0) return map;
  const { data, error } = await supabase
    .from("meta_ad_scripts")
    .select("ad_id, script_id, script:teleprompter_scripts(title)")
    .in("ad_id", adIds);
  if (error) {
    // migration 0059 ainda não aplicada: a tela segue funcionando sem vínculos
    console.warn("[adScriptLinks] vínculos indisponíveis:", error.message);
    return map;
  }
  for (const row of (data ?? []) as unknown as { ad_id: string; script_id: string; script: { title: string } | { title: string }[] | null }[]) {
    const script = Array.isArray(row.script) ? row.script[0] : row.script;
    map.set(row.ad_id, { scriptId: row.script_id, title: script?.title ?? "Roteiro" });
  }
  return map;
}

export async function linkAdToScript(supabase: SupabaseClient, adId: string, scriptId: string, userId: string | null) {
  const { error } = await supabase
    .from("meta_ad_scripts")
    .upsert({ ad_id: adId, script_id: scriptId, linked_by: userId }, { onConflict: "ad_id" });
  if (error) throw error;
}

export async function unlinkAd(supabase: SupabaseClient, adId: string) {
  const { error } = await supabase.from("meta_ad_scripts").delete().eq("ad_id", adId);
  if (error) throw error;
}

/** Anúncios que usam um roteiro (para mostrar no editor do Teleprompter). */
export async function fetchAdsForScript(supabase: SupabaseClient, scriptId: string) {
  const { data, error } = await supabase
    .from("meta_ad_scripts")
    .select("ad_id, ad:meta_ads(name)")
    .eq("script_id", scriptId);
  if (error) return [] as { adId: string; name: string }[];
  return ((data ?? []) as unknown as { ad_id: string; ad: { name: string } | { name: string }[] | null }[]).map((r) => {
    const ad = Array.isArray(r.ad) ? r.ad[0] : r.ad;
    return { adId: r.ad_id, name: ad?.name ?? "Anúncio" };
  });
}

/** IDs de roteiros que estão vinculados a algum anúncio (para o selo na lista). */
export async function fetchLinkedScriptIds(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("meta_ad_scripts").select("script_id");
  if (error) return new Map<string, number>();
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { script_id: string }[]) counts.set(r.script_id, (counts.get(r.script_id) ?? 0) + 1);
  return counts;
}
