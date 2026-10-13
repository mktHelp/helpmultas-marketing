"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { matchLead } from "@/lib/lead-matching";

// Exclusão e edição manual de leads: só o Master. A tabela landing_page_leads
// alimenta as abas Leads e Reuniões, então mexer aqui vale para as duas.

async function assertMaster() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "master") throw new Error("Apenas o Master pode excluir ou editar leads");
  return user.id;
}

export async function deleteLeadsAction(ids: string[]): Promise<{ deleted: number }> {
  const userId = await assertMaster();
  const list = [...new Set(ids)].slice(0, 500);
  if (list.length === 0) return { deleted: 0 };
  const admin = createAdminClient();

  const { data: rows, error: readError } = await admin.from("landing_page_leads").select("id, name, crm_lead_id").in("id", list);
  if (readError) throw new Error(readError.message);

  // Lembra os ids do CRM pra o próximo envio do webhook não recriar o lead.
  const tombstones = (rows ?? [])
    .filter((r) => r.crm_lead_id)
    .map((r) => ({ crm_lead_id: r.crm_lead_id as string, name: r.name ?? "", deleted_by: userId }));
  if (tombstones.length > 0) {
    const { error } = await admin.from("deleted_crm_leads").upsert(tombstones, { onConflict: "crm_lead_id" });
    if (error) throw new Error(error.message);
  }

  const { error } = await admin.from("landing_page_leads").delete().in("id", list);
  if (error) throw new Error(error.message);
  return { deleted: rows?.length ?? 0 };
}

const TEXT_FIELDS = [
  "name", "email", "phone", "city", "state", "capital", "capital_label",
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id",
  "crm_funnel_name", "crm_stage_name", "crm_phase_name", "crm_category_name", "last_meeting_status",
] as const;
const COUNT_FIELDS = ["meetings_count", "meetings_no_show", "meetings_rescheduled"] as const;
const DATE_FIELDS = ["first_meeting_at", "last_meeting_at"] as const;
const UTM_FIELDS = ["utm_campaign", "utm_content", "utm_term", "utm_id"] as const;
// Campos de funil/reunião do CRM guardam null quando vazios (e não "").
const NULLABLE_TEXT = new Set(["crm_funnel_name", "crm_stage_name", "crm_phase_name", "crm_category_name", "last_meeting_status"]);

export type LeadEditInput = Partial<Record<(typeof TEXT_FIELDS)[number], string>> &
  Partial<Record<(typeof COUNT_FIELDS)[number], number>> &
  Partial<Record<(typeof DATE_FIELDS)[number], string | null>> & { crm_locked?: boolean };

export async function updateLeadAction(id: string, input: LeadEditInput): Promise<{ ok: true }> {
  await assertMaster();
  const admin = createAdminClient();

  const patch: Record<string, unknown> = {};
  for (const k of TEXT_FIELDS) {
    if (input[k] === undefined) continue;
    const v = String(input[k]).trim();
    patch[k] = NULLABLE_TEXT.has(k) ? v || null : v;
  }
  for (const k of COUNT_FIELDS) {
    if (input[k] === undefined) continue;
    const n = Math.trunc(Number(input[k]));
    if (!Number.isFinite(n) || n < 0) throw new Error("Contagens de reunião devem ser números inteiros, zero ou mais");
    patch[k] = n;
  }
  for (const k of DATE_FIELDS) {
    if (input[k] === undefined) continue;
    if (!input[k]) {
      patch[k] = null;
      continue;
    }
    const d = new Date(input[k] as string);
    if (Number.isNaN(d.getTime())) throw new Error("Data de reunião inválida");
    patch[k] = d.toISOString();
  }
  if (input.crm_locked !== undefined) patch.crm_locked = !!input.crm_locked;
  if (Object.keys(patch).length === 0) return { ok: true };

  // UTM corrigida à mão: refaz o vínculo com campanha/conjunto/anúncio.
  if (UTM_FIELDS.some((k) => input[k] !== undefined)) {
    const { data: cur, error } = await admin
      .from("landing_page_leads")
      .select("utm_campaign, utm_content, utm_term, utm_id")
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    const merged = { ...cur, ...patch } as { utm_campaign: string; utm_content: string; utm_term: string; utm_id: string };
    const m = await matchLead(admin, merged);
    patch.matched_campaign_id = m.campaignId;
    patch.matched_adset_id = m.adSetId;
    patch.matched_ad_id = m.adId;
    patch.matched_by = m.matchedBy;
  }

  const { error } = await admin.from("landing_page_leads").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
