import type { SupabaseClient } from "@supabase/supabase-js";

// Casa as UTMs de um lead com a campanha/conjunto/anúncio da Meta que o
// gerou. IDs numéricos (macros {{ad.id}}, {{adset.id}}, {{campaign.id}}) são
// procurados em TODAS as UTMs, porque cada LP/link usa uma convenção
// diferente (ex: utm_id e utm_campaign com o id da campanha, utm_term com o
// do conjunto). Nomes (case-insensitive, exatos) só nos campos onde a
// convenção diz que o nome mora.

export interface LeadUtms {
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  utm_id?: string | null;
}

export interface LeadMatch {
  campaignId: string | null;
  adSetId: string | null;
  adId: string | null;
  matchedBy: string | null;
}

const clean = (v?: string | null) => (v ?? "").trim();

// %, _ e \ são curingas do LIKE — sem escapar, "link_in_bio" casaria
// "link-in-bio", "linkXinXbio", etc.
const escapeLike = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function matchLead(admin: SupabaseClient, utms: LeadUtms): Promise<LeadMatch> {
  const content = clean(utms.utm_content);
  const term = clean(utms.utm_term);
  const campaign = clean(utms.utm_campaign);
  const utmId = clean(utms.utm_id);
  const ids = [...new Set([content, term, campaign, utmId].filter((v) => /^\d{6,}$/.test(v)))];

  // 1. Anúncio
  if (ids.length > 0) {
    const { data } = await admin
      .from("meta_ads")
      .select("id, adset_id, adset:meta_ad_sets(campaign_id)")
      .in("meta_ad_id", ids)
      .limit(1);
    if (data?.[0]) return fromAd(data[0], "ad_id");
  }
  if (content) {
    const { data } = await admin
      .from("meta_ads")
      .select("id, adset_id, adset:meta_ad_sets(campaign_id)")
      .ilike("name", escapeLike(content))
      .limit(1);
    if (data?.[0]) return fromAd(data[0], "ad_name");
  }

  // 2. Conjunto
  if (ids.length > 0) {
    const { data } = await admin.from("meta_ad_sets").select("id, campaign_id").in("meta_adset_id", ids).limit(1);
    if (data?.[0]) return { campaignId: data[0].campaign_id, adSetId: data[0].id, adId: null, matchedBy: "adset_id" };
  }
  if (term) {
    const { data } = await admin.from("meta_ad_sets").select("id, campaign_id").ilike("name", escapeLike(term)).limit(1);
    if (data?.[0]) return { campaignId: data[0].campaign_id, adSetId: data[0].id, adId: null, matchedBy: "adset_name" };
  }

  // 3. Campanha
  if (ids.length > 0) {
    const { data } = await admin.from("meta_campaigns").select("id").in("meta_campaign_id", ids).limit(1);
    if (data?.[0]) return { campaignId: data[0].id, adSetId: null, adId: null, matchedBy: "campaign_id" };
  }
  if (campaign) {
    const { data } = await admin.from("meta_campaigns").select("id").ilike("name", escapeLike(campaign)).limit(1);
    if (data?.[0]) return { campaignId: data[0].id, adSetId: null, adId: null, matchedBy: "campaign_name" };
  }

  return { campaignId: null, adSetId: null, adId: null, matchedBy: null };
}

function fromAd(
  row: { id: string; adset_id: string; adset: unknown },
  matchedBy: string
): LeadMatch {
  const adset = row.adset as { campaign_id: string } | { campaign_id: string }[] | null;
  const campaignId = (Array.isArray(adset) ? adset[0] : adset)?.campaign_id ?? null;
  return { campaignId, adSetId: row.adset_id, adId: row.id, matchedBy };
}

// Leads que chegaram antes do anúncio/campanha existir na base (sync só
// roda 1x/dia e pega só campanhas ativas) ficam sem vínculo. Chamado ao fim
// de cada sync pra tentar de novo, sem nunca piorar um vínculo existente.
export async function rematchUnmatchedLeads(admin: SupabaseClient): Promise<number> {
  const { data: leads } = await admin
    .from("landing_page_leads")
    .select("id, utm_campaign, utm_content, utm_term, utm_id, matched_campaign_id, matched_adset_id, matched_ad_id")
    .is("matched_ad_id", null)
    .order("received_at", { ascending: false })
    .limit(1000);

  let updated = 0;
  for (const lead of leads ?? []) {
    const m = await matchLead(admin, lead);
    const improves =
      !!m.adId || (!!m.adSetId && !lead.matched_adset_id) || (!!m.campaignId && !lead.matched_campaign_id);
    if (!improves) continue;
    const { error } = await admin
      .from("landing_page_leads")
      .update({
        matched_campaign_id: m.campaignId ?? lead.matched_campaign_id,
        matched_adset_id: m.adSetId ?? lead.matched_adset_id,
        matched_ad_id: m.adId,
        matched_by: m.matchedBy,
      })
      .eq("id", lead.id);
    if (!error) updated++;
  }
  return updated;
}
