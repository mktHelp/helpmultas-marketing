import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

// Ingestão de leads da LP — chamada em paralelo ao envio pro CRM (mesmo
// payload de sendToTestCrm), autenticada com um shared secret
// (LEADS_INGEST_TOKEN) já que não há sessão de usuário Supabase na LP.
//
// Casa a UTM do lead com a campanha/conjunto/anúncio da Meta que gerou o
// clique, do nível mais específico pro mais genérico:
//   utm_content → anúncio (convenção usual: {{ad.name}} ou {{ad.id}})
//   utm_term    → conjunto de anúncios ({{adset.name}} ou {{adset.id}})
//   utm_campaign → campanha ({{campaign.name}} ou {{campaign.id}})
// Sempre tenta o id exato primeiro (caso a LP use os macros {{*.id}} da
// Meta) e cai pro nome (case-insensitive) se não achar — sem usar filtros
// .or() com a UTM interpolada direto na string, que viria de input público
// da internet e quebraria (ou seria injetável) se tivesse vírgula/parênteses.

interface LeadPayload {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  capital?: string | number | boolean;
  capitalLabel?: string;
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  utm_id?: string;
}

async function matchAd(admin: SupabaseClient, utmContent: string) {
  if (!utmContent) return null;
  const byId = await admin
    .from("meta_ads")
    .select("id, adset_id, adset:meta_ad_sets(campaign_id)")
    .eq("meta_ad_id", utmContent)
    .maybeSingle();
  if (byId.data) return { ...byId.data, matchedBy: "ad_id" as const };

  const byName = await admin
    .from("meta_ads")
    .select("id, adset_id, adset:meta_ad_sets(campaign_id)")
    .ilike("name", utmContent)
    .limit(1)
    .maybeSingle();
  if (byName.data) return { ...byName.data, matchedBy: "ad_name" as const };
  return null;
}

async function matchAdSet(admin: SupabaseClient, utmTerm: string) {
  if (!utmTerm) return null;
  const byId = await admin.from("meta_ad_sets").select("id, campaign_id").eq("meta_adset_id", utmTerm).maybeSingle();
  if (byId.data) return { ...byId.data, matchedBy: "adset_id" as const };

  const byName = await admin.from("meta_ad_sets").select("id, campaign_id").ilike("name", utmTerm).limit(1).maybeSingle();
  if (byName.data) return { ...byName.data, matchedBy: "adset_name" as const };
  return null;
}

async function matchCampaign(admin: SupabaseClient, utmCampaign: string) {
  if (!utmCampaign) return null;
  const byId = await admin.from("meta_campaigns").select("id").eq("meta_campaign_id", utmCampaign).maybeSingle();
  if (byId.data) return { ...byId.data, matchedBy: "campaign_id" as const };

  const byName = await admin.from("meta_campaigns").select("id").ilike("name", utmCampaign).limit(1).maybeSingle();
  if (byName.data) return { ...byName.data, matchedBy: "campaign_name" as const };
  return null;
}

export async function POST(request: Request) {
  const token = process.env.LEADS_INGEST_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "LEADS_INGEST_TOKEN não configurado" }, { status: 500 });
  }
  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as LeadPayload | null;
  if (!body) {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const utmContent = (body.utm_content ?? "").trim();
  const utmTerm = (body.utm_term ?? "").trim();
  const utmCampaign = (body.utm_campaign ?? "").trim();

  let matchedAdId: string | null = null;
  let matchedAdSetId: string | null = null;
  let matchedCampaignId: string | null = null;
  let matchedBy: string | null = null;

  const ad = await matchAd(admin, utmContent);
  if (ad) {
    matchedAdId = ad.id;
    matchedAdSetId = ad.adset_id;
    matchedCampaignId = (ad.adset as unknown as { campaign_id: string } | null)?.campaign_id ?? null;
    matchedBy = ad.matchedBy;
  } else {
    const adSet = await matchAdSet(admin, utmTerm);
    if (adSet) {
      matchedAdSetId = adSet.id;
      matchedCampaignId = adSet.campaign_id;
      matchedBy = adSet.matchedBy;
    } else {
      const campaign = await matchCampaign(admin, utmCampaign);
      if (campaign) {
        matchedCampaignId = campaign.id;
        matchedBy = campaign.matchedBy;
      }
    }
  }

  const { data, error } = await admin
    .from("landing_page_leads")
    .insert({
      name: (body.name ?? "").trim(),
      email: (body.email ?? "").trim(),
      phone: body.phone ?? "",
      city: (body.city ?? "").trim(),
      state: body.state ?? "",
      capital: body.capital !== undefined && body.capital !== null ? String(body.capital) : "",
      capital_label: body.capitalLabel ?? "",
      fbp: body.fbp ?? "",
      fbc: body.fbc ?? "",
      fbclid: body.fbclid ?? "",
      utm_source: body.utm_source ?? "",
      utm_medium: body.utm_medium ?? "",
      utm_campaign: body.utm_campaign ?? "",
      utm_content: body.utm_content ?? "",
      utm_term: body.utm_term ?? "",
      utm_id: body.utm_id ?? "",
      matched_campaign_id: matchedCampaignId,
      matched_adset_id: matchedAdSetId,
      matched_ad_id: matchedAdId,
      matched_by: matchedBy,
      raw_payload: body,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    matched: { campaign: matchedCampaignId, adset: matchedAdSetId, ad: matchedAdId },
  });
}
