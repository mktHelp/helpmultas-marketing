/**
 * Importa leads de uma exportação do CRM (já convertida em JSON) para
 * landing_page_leads, com a data de recebimento original e o vínculo com
 * campanha/conjunto/anúncio pelas UTMs (mesmo matching do POST /api/leads).
 * Por padrão só SIMULA; use --apply para gravar. Reexecutar é seguro: leads
 * já importados (raw_payload.crm_lead_id) são pulados.
 *
 *   npx tsx scripts/import-crm-leads.ts caminho/leads.json [--apply]
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { matchLead } from "../src/lib/lead-matching";

config({ path: ".env.local" });

interface CrmLead {
  crm_id: string; received_at: string; name: string; phone: string; email: string;
  utm_source: string; utm_medium: string; utm_campaign: string; utm_content: string; utm_term: string; utm_id: string;
  fbp: string; fbc: string; fbclid: string; capital: string; capital_label: string;
  crm_origem: string; crm_etapa: string; crm_categoria: string;
}

const file = process.argv[2];
const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!file || !url || !key) throw new Error("Uso: tsx scripts/import-crm-leads.ts leads.json [--apply] (precisa de .env.local)");

const admin = createClient(url, key, { auth: { persistSession: false } });
const leads: CrmLead[] = JSON.parse(readFileSync(file, "utf-8"));

async function main() {
  // Já importados antes (por id do CRM) — paginado, o PostgREST corta em 1000.
  // Também pula quem já está no banco (mesmo telefone ou e-mail, ex.: lead que
  // chegou pela LP), pra não duplicar.
  const done = new Set<string>();
  const phones = new Set<string>();
  const emails = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("landing_page_leads").select("raw_payload, phone, email").range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) {
      const id = (r.raw_payload as { crm_lead_id?: string } | null)?.crm_lead_id;
      if (id) done.add(id);
      const ph = (r.phone ?? "").replace(/\D/g, "");
      if (ph) phones.add(ph);
      if (r.email) emails.add(r.email.toLowerCase());
    }
    if (!data || data.length < 1000) break;
  }

  const stats = { total: leads.length, skipped: 0, inserted: 0, withAd: 0, withAdset: 0, withCampaign: 0, noMatch: 0, errors: 0 };
  const byMatch: Record<string, number> = {};
  const rows: Record<string, unknown>[] = [];

  for (const l of leads) {
    const ph = l.phone.replace(/\D/g, "");
    if (done.has(l.crm_id) || (ph && phones.has(ph)) || (l.email && emails.has(l.email.toLowerCase()))) { stats.skipped++; continue; }
    const m = await matchLead(admin, l);
    if (m.adId) stats.withAd++; else if (m.adSetId) stats.withAdset++; else if (m.campaignId) stats.withCampaign++; else stats.noMatch++;
    byMatch[m.matchedBy ?? "sem vínculo"] = (byMatch[m.matchedBy ?? "sem vínculo"] ?? 0) + 1;
    rows.push({
      name: l.name, email: l.email, phone: l.phone,
      fbp: l.fbp, fbc: l.fbc, fbclid: l.fbclid,
      utm_source: l.utm_source, utm_medium: l.utm_medium, utm_campaign: l.utm_campaign,
      utm_content: l.utm_content, utm_term: l.utm_term, utm_id: l.utm_id,
      capital: l.capital, capital_label: l.capital_label,
      matched_campaign_id: m.campaignId, matched_adset_id: m.adSetId, matched_ad_id: m.adId, matched_by: m.matchedBy,
      received_at: l.received_at, created_at: l.received_at,
      raw_payload: { crm_lead_id: l.crm_id, crm_origem: l.crm_origem, crm_etapa: l.crm_etapa, crm_categoria: l.crm_categoria, imported: "crm-export" },
    });
  }

  if (apply) {
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error } = await admin.from("landing_page_leads").insert(chunk);
      if (error) { console.error(`Lote ${i}: ${error.message}`); stats.errors += chunk.length; } else stats.inserted += chunk.length;
    }
  }
  console.log(apply ? "APLICADO" : "SIMULAÇÃO (nada gravado)", { ...stats, aGravar: rows.length }, byMatch);
}
main().catch((e) => { console.error(e); process.exit(1); });
