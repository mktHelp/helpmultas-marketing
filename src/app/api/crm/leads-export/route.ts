import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { matchLead, type LeadMatch } from "@/lib/lead-matching";

// Webhook do CRM (evento leads.export, a cada 3h): retrato atual de cada lead
// com funil/etapa, UTMs e resumo de reuniões. Autenticado por Bearer token
// (CRM_WEBHOOK_TOKEN). Cada lead atualiza o mesmo registro de
// landing_page_leads — por crm_lead_id, ou por telefone/e-mail quando o lead
// já tinha chegado pela LP — e cada mudança de etapa vira uma linha em
// crm_lead_stage_history.

export const maxDuration = 60;

interface CrmMeetings {
  total?: number | null;
  noShow?: number | null;
  rescheduled?: number | null;
  firstAt?: string | null;
  lastAt?: string | null;
  lastStatus?: string | null;
}

interface CrmLead {
  id?: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  funnelName?: string | null;
  stageName?: string | null;
  previousStageName?: string | null;
  stagePhaseName?: string | null;
  stageCategoryName?: string | null;
  source?: string | null;
  createdAt?: string | null;
  addressState?: string | null;
  stageEnteredAt?: string | null;
  lastMovementAt?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  utmId?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  fbclid?: string | null;
  capital?: string | null;
  capitalLabel?: string | null;
  meetings?: CrmMeetings | null;
}

interface ExistingLead {
  id: string;
  crm_lead_id: string | null;
  phone_digits: string | null;
  email: string;
  crm_stage_name: string | null;
  crm_stage_entered_at: string | null;
  crm_last_movement_at: string | null;
  meetings_count: number;
  meetings_no_show: number;
  meetings_rescheduled: number;
  last_meeting_at: string | null;
  last_meeting_status: string | null;
  matched_ad_id: string | null;
  matched_adset_id: string | null;
  matched_campaign_id: string | null;
}

const EXISTING_COLS =
  "id, crm_lead_id, phone_digits, email, crm_stage_name, crm_stage_entered_at, crm_last_movement_at, meetings_count, meetings_no_show, meetings_rescheduled, last_meeting_at, last_meeting_status, matched_ad_id, matched_adset_id, matched_campaign_id";

const CHUNK = 200;

const s = (v?: string | null) => (v ?? "").trim();
const digits = (v?: string | null) => (v ?? "").replace(/\D/g, "");
const iso = (v?: string | null) => {
  if (!v) return null;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
};
const sameInstant = (a?: string | null, b?: string | null) => (iso(a) ?? null) === (iso(b) ?? null);

function chunks<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// Telefone do CRM vem com DDI (554198405563); o da LP pode vir sem. Casa pelas
// duas formas.
function phoneVariants(phone?: string | null): string[] {
  const d = digits(phone);
  if (d.length < 10) return [];
  return d.startsWith("55") && d.length > 11 ? [d, d.slice(2)] : [d, `55${d}`];
}

// Lead do formulário nativo da Meta passa pela etapa "Formulario Nativo" no CRM.
function pageOriginFor(l: CrmLead) {
  return /formul[aá]rio nativo/i.test(l.previousStageName ?? "") || /formul[aá]rio nativo/i.test(l.stageName ?? "")
    ? "forms"
    : "crm";
}

function crmFields(l: CrmLead) {
  const m = l.meetings ?? {};
  return {
    crm_funnel_name: s(l.funnelName) || null,
    crm_stage_name: s(l.stageName) || null,
    crm_previous_stage_name: s(l.previousStageName) || null,
    crm_phase_name: s(l.stagePhaseName) || null,
    crm_category_name: s(l.stageCategoryName) || null,
    crm_source: s(l.source) || null,
    crm_stage_entered_at: iso(l.stageEnteredAt),
    crm_last_movement_at: iso(l.lastMovementAt),
    meetings_count: m.total ?? 0,
    meetings_no_show: m.noShow ?? 0,
    meetings_rescheduled: m.rescheduled ?? 0,
    first_meeting_at: iso(m.firstAt),
    last_meeting_at: iso(m.lastAt),
    last_meeting_status: s(m.lastStatus) || null,
  };
}

export async function POST(request: Request) {
  const token = process.env.CRM_WEBHOOK_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "CRM_WEBHOOK_TOKEN não configurado" }, { status: 500 });
  }
  if ((request.headers.get("authorization") || "") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { event?: string; leads?: CrmLead[] } | null;
  if (!body || !Array.isArray(body.leads)) {
    return NextResponse.json({ error: "Corpo inválido: esperado { event, leads[] }" }, { status: 400 });
  }
  if (body.event && body.event !== "leads.export") {
    return NextResponse.json({ ok: true, ignored: `evento ${body.event}` });
  }

  const admin = createAdminClient();
  const leads = body.leads.filter((l) => s(l.id));
  const stats = { received: body.leads.length, inserted: 0, updated: 0, unchanged: 0, linkedToExisting: 0, stageChanges: 0, errors: 0 };
  const errors: string[] = [];

  // 1. Já conhecidos pelo id do CRM.
  const byCrmId = new Map<string, ExistingLead>();
  for (const part of chunks(leads.map((l) => s(l.id)))) {
    const { data, error } = await admin.from("landing_page_leads").select(EXISTING_COLS).in("crm_lead_id", part);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const r of (data ?? []) as ExistingLead[]) byCrmId.set(r.crm_lead_id!, r);
  }

  // 2. Os demais: lead da LP que ainda não tem crm_lead_id (casa por telefone/e-mail).
  const rest = leads.filter((l) => !byCrmId.has(s(l.id)));
  const byPhone = new Map<string, ExistingLead>();
  const byEmail = new Map<string, ExistingLead>();
  const phones = [...new Set(rest.flatMap((l) => phoneVariants(l.phone)))];
  const emails = [...new Set(rest.map((l) => s(l.email).toLowerCase()).filter(Boolean))];
  for (const part of chunks(phones)) {
    const { data } = await admin.from("landing_page_leads").select(EXISTING_COLS).is("crm_lead_id", null).in("phone_digits", part);
    for (const r of (data ?? []) as ExistingLead[]) if (r.phone_digits) byPhone.set(r.phone_digits, r);
  }
  for (const part of chunks(emails)) {
    const { data } = await admin.from("landing_page_leads").select(EXISTING_COLS).is("crm_lead_id", null).in("email", part);
    for (const r of (data ?? []) as ExistingLead[]) byEmail.set(r.email.toLowerCase(), r);
  }

  const matchCache = new Map<string, LeadMatch>();
  async function match(l: CrmLead) {
    const key = [l.utmCampaign, l.utmContent, l.utmTerm, l.utmId].map(s).join("|");
    let m = matchCache.get(key);
    if (!m) {
      m = await matchLead(admin, { utm_campaign: l.utmCampaign, utm_content: l.utmContent, utm_term: l.utmTerm, utm_id: l.utmId });
      matchCache.set(key, m);
    }
    return m;
  }

  const now = new Date().toISOString();
  const toInsert: { crmId: string; row: Record<string, unknown>; lead: CrmLead }[] = [];
  const toUpdate: { row: Record<string, unknown>; lead: CrmLead; stageChanged: boolean }[] = [];
  const claimed = new Set<string>();

  for (const l of leads) {
    const crmId = s(l.id);
    let ex = byCrmId.get(crmId);
    let linked = false;
    if (!ex) {
      ex = phoneVariants(l.phone).map((p) => byPhone.get(p)).find(Boolean) ?? byEmail.get(s(l.email).toLowerCase());
      if (ex && claimed.has(ex.id)) ex = undefined;
      if (ex) {
        claimed.add(ex.id);
        linked = true;
      }
    }

    const fields = crmFields(l);

    if (!ex) {
      const m = await match(l);
      toInsert.push({
        crmId,
        lead: l,
        row: {
          crm_lead_id: crmId,
          page_origin: pageOriginFor(l),
          name: s(l.name),
          email: s(l.email),
          phone: s(l.phone),
          state: s(l.addressState),
          capital: s(l.capital),
          capital_label: s(l.capitalLabel),
          fbp: s(l.fbp),
          fbc: s(l.fbc),
          fbclid: s(l.fbclid),
          utm_source: s(l.utmSource),
          utm_medium: s(l.utmMedium),
          utm_campaign: s(l.utmCampaign),
          utm_content: s(l.utmContent),
          utm_term: s(l.utmTerm),
          utm_id: s(l.utmId),
          matched_campaign_id: m.campaignId,
          matched_adset_id: m.adSetId,
          matched_ad_id: m.adId,
          matched_by: m.matchedBy,
          received_at: iso(l.createdAt) ?? now,
          created_at: iso(l.createdAt) ?? now,
          crm_synced_at: now,
          ...fields,
          raw_payload: { crm_lead_id: crmId, imported: "crm-webhook" },
        },
      });
      continue;
    }

    const stageChanged = !sameInstant(ex.crm_stage_entered_at, fields.crm_stage_entered_at) || ex.crm_stage_name !== fields.crm_stage_name;
    const changed =
      linked ||
      stageChanged ||
      !sameInstant(ex.crm_last_movement_at, fields.crm_last_movement_at) ||
      ex.meetings_count !== fields.meetings_count ||
      ex.meetings_no_show !== fields.meetings_no_show ||
      ex.meetings_rescheduled !== fields.meetings_rescheduled ||
      !sameInstant(ex.last_meeting_at, fields.last_meeting_at) ||
      ex.last_meeting_status !== fields.last_meeting_status;

    // Lead ainda sem anúncio vinculado ganha outra chance de casar (UTMs do CRM).
    let rematch: Record<string, unknown> = {};
    if (!ex.matched_ad_id) {
      const m = await match(l);
      if (m.adId || (m.adSetId && !ex.matched_adset_id) || (m.campaignId && !ex.matched_campaign_id)) {
        rematch = {
          matched_campaign_id: m.campaignId ?? ex.matched_campaign_id,
          matched_adset_id: m.adSetId ?? ex.matched_adset_id,
          matched_ad_id: m.adId,
          matched_by: m.matchedBy,
        };
      }
    }

    if (!changed && Object.keys(rematch).length === 0) {
      stats.unchanged++;
      continue;
    }
    if (linked) stats.linkedToExisting++;
    toUpdate.push({ lead: l, stageChanged, row: { id: ex.id, crm_lead_id: crmId, crm_synced_at: now, ...fields, ...rematch } });
  }

  // Histórico de etapa: lead_id + entered_at únicos, então reenvio não duplica.
  const history: Record<string, unknown>[] = [];
  const pushHistory = (leadId: string, l: CrmLead) => {
    const entered = iso(l.stageEnteredAt);
    if (!entered || !s(l.stageName)) return;
    history.push({
      lead_id: leadId,
      stage_name: s(l.stageName),
      previous_stage_name: s(l.previousStageName) || null,
      phase_name: s(l.stagePhaseName) || null,
      category_name: s(l.stageCategoryName) || null,
      entered_at: entered,
    });
  };

  for (const part of chunks(toInsert)) {
    const { data, error } = await admin
      .from("landing_page_leads")
      .upsert(part.map((p) => p.row), { onConflict: "crm_lead_id" })
      .select("id, crm_lead_id");
    if (error) {
      stats.errors += part.length;
      errors.push(error.message);
      continue;
    }
    stats.inserted += part.length;
    const ids = new Map((data ?? []).map((r) => [r.crm_lead_id as string, r.id as string]));
    for (const p of part) {
      const id = ids.get(p.crmId);
      if (id) pushHistory(id, p.lead);
    }
  }

  for (const part of chunks(toUpdate)) {
    const { error } = await admin.from("landing_page_leads").upsert(part.map((p) => p.row), { onConflict: "id" });
    if (error) {
      stats.errors += part.length;
      errors.push(error.message);
      continue;
    }
    stats.updated += part.length;
    for (const p of part) {
      if (p.stageChanged) {
        pushHistory(p.row.id as string, p.lead);
        stats.stageChanges++;
      }
    }
  }

  for (const part of chunks(history, 500)) {
    const { error } = await admin
      .from("crm_lead_stage_history")
      .upsert(part, { onConflict: "lead_id,entered_at", ignoreDuplicates: true });
    if (error) errors.push(`histórico: ${error.message}`);
  }

  return NextResponse.json({ ok: stats.errors === 0, ...stats, errors: errors.slice(0, 5) }, { status: stats.errors ? 207 : 200 });
}
