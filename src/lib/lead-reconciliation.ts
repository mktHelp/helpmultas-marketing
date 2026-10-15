import type { SupabaseClient } from "@supabase/supabase-js";

// Validação de leads (a cada 3h, ver app/api/leads/reconcile e
// .github/workflows/lead-reconciliation.yml): compara o que se cadastrou na
// LP (POST /api/leads) e no formulário nativo da Meta (puxado da Graph API
// para meta_form_leads) com o que o CRM exporta (crm_lead_id em
// landing_page_leads). Gera um retrato por ciclo em lead_reconciliation_runs
// com os leads fora do CRM e os duplicados.

const GRAPH_BASE = "https://graph.facebook.com/v21.0";
// Janela analisada a cada ciclo.
export const WINDOW_DAYS = 7;
// O CRM exporta a cada 3h: lead mais novo que isso ainda pode chegar no
// próximo envio, então fica como "aguardando" em vez de "fora do CRM".
const GRACE_MS = 3.5 * 60 * 60 * 1000;
const GRAPH_CONCURRENCY = 5;
const PAGE = 1000;
const LIST_CAP = 500;

export interface IssueLead {
  id: string;
  source: "lp" | "nativo" | "crm";
  name: string;
  email: string;
  phone: string;
  at: string;
  origin: string;
  crm_lead_id?: string | null;
  crm_stage?: string | null;
}

export interface DuplicateGroup {
  source: "lp" | "nativo" | "crm";
  key: string;
  leads: IssueLead[];
}

export interface ReconciliationSummary {
  lp_total: number;
  lp_in_crm: number;
  lp_missing: number;
  lp_pending: number;
  native_total: number;
  native_in_crm: number;
  native_missing: number;
  native_pending: number;
  native_error: string | null;
  dup_lp: number;
  dup_native: number;
  dup_crm: number;
}

export interface ReconciliationIssues {
  missing: IssueLead[];
  /** recebidos há menos de 3h30, ainda podem vir no próximo export do CRM */
  pending?: IssueLead[];
  duplicates: DuplicateGroup[];
}

// Telefone do CRM vem com DDI (554198405563), o da LP às vezes sem: compara
// sem o 55.
export function phoneKey(phone?: string | null): string {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length < 10) return "";
  return d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
}
const emailKey = (e?: string | null) => (e ?? "").trim().toLowerCase();

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

interface GraphLead {
  id: string;
  created_time: string;
  form_id?: string;
  field_data?: { name: string; values?: string[] }[];
}

function field(data: GraphLead["field_data"], ...names: string[]) {
  const f = data?.find((x) => names.includes(x.name.toLowerCase()));
  return (f?.values?.[0] ?? "").trim();
}

// Puxa os leads do formulário nativo por Página → formulário (igual ao n8n):
// /me/accounts dá o token de cada Página, /{page}/leadgen_forms lista os
// formulários e /{form}/leads traz os leads (com ad_id/ad_name). Exige o
// token do usuário do sistema com leads_retrieval e a Página atribuída a ele.
async function syncNativeLeads(admin: SupabaseClient, since: Date): Promise<void> {
  // Token próprio (app com leads_retrieval), separado do token do sync de
  // tráfego; sem ele, tenta o token geral.
  const token = process.env.META_LEADS_TOKEN || process.env.META_SYSTEM_USER_TOKEN;
  if (!token) throw new Error("META_LEADS_TOKEN não configurado");

  const get = async <T,>(path: string, params: Record<string, string>, accessToken: string) => {
    const json = (await (
      await fetch(`${GRAPH_BASE}${path}?${new URLSearchParams({ ...params, access_token: accessToken })}`)
    ).json()) as T & { error?: { message: string } };
    if (json.error) throw new Error(`Meta API (${path}): ${json.error.message}`);
    return json;
  };
  const getAll = async <T,>(path: string, params: Record<string, string>, accessToken: string) => {
    const out: T[] = [];
    let json = await get<{ data?: T[]; paging?: { next?: string } }>(path, params, accessToken);
    for (;;) {
      out.push(...(json.data ?? []));
      const next = json.paging?.next;
      if (!next) return out;
      const res = (await (await fetch(next)).json()) as typeof json & { error?: { message: string } };
      if (res.error) throw new Error(`Meta API (${path}): ${res.error.message}`);
      json = res;
    }
  };

  const pages = await getAll<{ id: string; name: string; access_token?: string }>(
    "/me/accounts",
    { fields: "id,name,access_token", limit: "50" },
    token,
  );
  if (!pages.length) throw new Error("nenhuma Página atribuída ao usuário do sistema (me/accounts vazio)");

  const filtering = JSON.stringify([
    { field: "time_created", operator: "GREATER_THAN", value: Math.floor(since.getTime() / 1000) },
  ]);
  const rows: Record<string, unknown>[] = [];

  for (const page of pages) {
    const pageToken = page.access_token ?? token;
    const forms = await getAll<{ id: string }>("/" + page.id + "/leadgen_forms", { fields: "id,name", limit: "100" }, pageToken);
    await mapLimit(forms, GRAPH_CONCURRENCY, async (form) => {
      const leads = await getAll<GraphLead & { ad_id?: string; ad_name?: string }>(
        "/" + form.id + "/leads",
        { fields: "id,created_time,form_id,ad_id,ad_name,field_data", filtering, limit: "100" },
        pageToken,
      );
      for (const l of leads) {
        rows.push({
          leadgen_id: l.id,
          form_id: l.form_id ?? form.id,
          meta_ad_id: l.ad_id ?? "",
          ad_name: l.ad_name ?? "",
          name: field(l.field_data, "full_name", "nome", "nome_completo", "first_name"),
          email: field(l.field_data, "email", "e-mail"),
          phone: field(l.field_data, "phone_number", "telefone", "phone", "whatsapp"),
          field_data: l.field_data ?? [],
          created_time: new Date(l.created_time).toISOString(),
          synced_at: new Date().toISOString(),
        });
      }
    });
  }

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from("meta_form_leads").upsert(rows.slice(i, i + 500), { onConflict: "leadgen_id" });
    if (error) throw new Error(error.message);
  }
}

interface LpRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  page_origin: string;
  received_at: string;
  crm_lead_id: string | null;
  crm_stage_name: string | null;
}

interface NativeRow {
  leadgen_id: string;
  name: string;
  email: string;
  phone: string;
  ad_name: string;
  created_time: string;
}

function duplicateGroups(source: DuplicateGroup["source"], leads: IssueLead[]): DuplicateGroup[] {
  // Une por telefone OU e-mail (union-find simples sobre os índices).
  const parent = leads.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const seen = new Map<string, number>();
  leads.forEach((l, i) => {
    for (const k of [phoneKey(l.phone) && `p:${phoneKey(l.phone)}`, emailKey(l.email) && `e:${emailKey(l.email)}`]) {
      if (!k) continue;
      const j = seen.get(k);
      if (j === undefined) seen.set(k, i);
      else parent[find(i)] = find(j);
    }
  });
  const groups = new Map<number, IssueLead[]>();
  leads.forEach((l, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), l]);
  });
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => ({ source, key: phoneKey(g[0].phone) || emailKey(g[0].email), leads: g }));
}

export async function runReconciliation(admin: SupabaseClient) {
  const now = Date.now();
  const since = new Date(now - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const graceCut = now - GRACE_MS;

  const { data: run, error: runErr } = await admin
    .from("lead_reconciliation_runs")
    .insert({ window_since: since.toISOString() })
    .select("id")
    .single();
  if (runErr || !run) throw new Error(runErr?.message ?? "não foi possível criar o ciclo");

  try {
    let nativeError: string | null = null;
    try {
      await syncNativeLeads(admin, since);
    } catch (e) {
      nativeError = e instanceof Error ? e.message : String(e);
    }

    const cols = "id, name, email, phone, page_origin, received_at, crm_lead_id, crm_stage_name";
    // Todo lead que o CRM já exportou (qualquer data) — base pra saber se um
    // lead da LP/nativo "está no CRM", mesmo que tenha caído em outro registro.
    const crmRows = await fetchAll<LpRow>((a, b) =>
      admin.from("landing_page_leads").select(cols).not("crm_lead_id", "is", null).range(a, b),
    );
    const lpRows = await fetchAll<LpRow>((a, b) =>
      admin
        .from("landing_page_leads")
        .select(cols)
        .not("page_origin", "in", "(crm,forms)")
        .gte("received_at", since.toISOString())
        .range(a, b),
    );
    const nativeRows = await fetchAll<NativeRow>((a, b) =>
      admin
        .from("meta_form_leads")
        .select("leadgen_id, name, email, phone, ad_name, created_time")
        .gte("created_time", since.toISOString())
        .range(a, b),
    );

    const crmPhones = new Set(crmRows.map((r) => phoneKey(r.phone)).filter(Boolean));
    const crmEmails = new Set(crmRows.map((r) => emailKey(r.email)).filter(Boolean));
    const inCrm = (phone: string, email: string) =>
      (!!phoneKey(phone) && crmPhones.has(phoneKey(phone))) || (!!emailKey(email) && crmEmails.has(emailKey(email)));

    const lpLeads: IssueLead[] = lpRows.map((r) => ({
      id: r.id,
      source: "lp",
      name: r.name,
      email: r.email,
      phone: r.phone,
      at: r.received_at,
      origin: r.page_origin,
      crm_lead_id: r.crm_lead_id,
      crm_stage: r.crm_stage_name,
    }));
    const nativeLeads: IssueLead[] = nativeRows.map((r) => ({
      id: r.leadgen_id,
      source: "nativo",
      name: r.name,
      email: r.email,
      phone: r.phone,
      at: r.created_time,
      origin: r.ad_name,
    }));

    const classify = (leads: IssueLead[]) => {
      let ok = 0;
      const pending: IssueLead[] = [];
      const missing: IssueLead[] = [];
      for (const l of leads) {
        if (l.crm_lead_id || inCrm(l.phone, l.email)) ok++;
        else if (new Date(l.at).getTime() > graceCut) pending.push(l);
        else missing.push(l);
      }
      return { ok, pending, missing };
    };
    const lp = classify(lpLeads);
    const nat = classify(nativeLeads);

    const crmWindow: IssueLead[] = crmRows.map((r) => ({
      id: r.id,
      source: "crm",
      name: r.name,
      email: r.email,
      phone: r.phone,
      at: r.received_at,
      origin: r.page_origin,
      crm_lead_id: r.crm_lead_id,
      crm_stage: r.crm_stage_name,
    }));
    const dupLp = duplicateGroups("lp", lpLeads);
    const dupNative = duplicateGroups("nativo", nativeLeads);
    // Duplicado no CRM: mesmo telefone/e-mail com ids de CRM diferentes, em
    // grupos que tenham ao menos um lead recebido na janela.
    const dupCrm = duplicateGroups("crm", crmWindow).filter((g) => g.leads.some((l) => l.at >= since.toISOString()));

    const summary: ReconciliationSummary = {
      lp_total: lpLeads.length,
      lp_in_crm: lp.ok,
      lp_missing: lp.missing.length,
      lp_pending: lp.pending.length,
      native_total: nativeLeads.length,
      native_in_crm: nat.ok,
      native_missing: nat.missing.length,
      native_pending: nat.pending.length,
      native_error: nativeError,
      dup_lp: dupLp.length,
      dup_native: dupNative.length,
      dup_crm: dupCrm.length,
    };
    const issues: ReconciliationIssues = {
      missing: [...lp.missing, ...nat.missing].sort((a, b) => b.at.localeCompare(a.at)).slice(0, LIST_CAP),
      pending: [...lp.pending, ...nat.pending].sort((a, b) => b.at.localeCompare(a.at)),
      duplicates: [...dupLp, ...dupNative, ...dupCrm].slice(0, LIST_CAP),
    };

    await admin
      .from("lead_reconciliation_runs")
      .update({ status: "success", finished_at: new Date().toISOString(), summary, issues })
      .eq("id", run.id);
    return { id: run.id, summary };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin
      .from("lead_reconciliation_runs")
      .update({ status: "error", finished_at: new Date().toISOString(), error: message })
      .eq("id", run.id);
    throw e;
  }
}
