import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { matchLead } from "@/lib/lead-matching";

// Ingestão de leads da LP — chamada em paralelo ao envio pro CRM (mesmo
// payload de sendToTestCrm), autenticada com um shared secret
// (LEADS_INGEST_TOKEN) já que não há sessão de usuário Supabase na LP.
// O casamento das UTMs com campanha/conjunto/anúncio mora em
// lib/lead-matching.ts (também reaplicado a cada sync da Meta).

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

// A LP chama esta rota direto do navegador (outro domínio) com header
// Authorization + JSON, o que dispara um preflight OPTIONS. Sem estes headers
// o navegador bloqueia o POST antes de ele sair. A proteção real é o Bearer
// token, não a origem.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const token = process.env.LEADS_INGEST_TOKEN;
  if (!token) {
    return json({ error: "LEADS_INGEST_TOKEN não configurado" }, 500);
  }
  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${token}`) {
    return json({ error: "Não autorizado" }, 401);
  }

  const body = (await request.json().catch(() => null)) as LeadPayload | null;
  if (!body) {
    return json({ error: "Corpo inválido" }, 400);
  }

  const admin = createAdminClient();
  const match = await matchLead(admin, body);

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
      matched_campaign_id: match.campaignId,
      matched_adset_id: match.adSetId,
      matched_ad_id: match.adId,
      matched_by: match.matchedBy,
      raw_payload: body,
    })
    .select("id")
    .single();

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({
    ok: true,
    id: data.id,
    matched: { campaign: match.campaignId, adset: match.adSetId, ad: match.adId },
  });
}
