"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Copy, ExternalLink, FileText, Mail, MessageCircle, Phone, Search } from "lucide-react";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { DuplicateGroup, IssueLead } from "@/lib/lead-reconciliation";
import { SOURCE_LABEL, SourceBadge, ageLabel, fmtDateTime, onlyDigits, whatsappUrl, type LeadStatus } from "./shared";

interface Candidate {
  id: string;
  name: string;
  phone: string;
  email: string;
  crm_lead_id: string | null;
  crm_stage_name: string | null;
  crm_funnel_name: string | null;
  received_at: string;
  reasons: string[];
}

type Answer = { name: string; values?: string[] };

const prettyField = (k: string) =>
  k.replace(/_/g, " ").replace(/\?/g, "").trim().replace(/^\w/, (c) => c.toUpperCase());

const STATUS: Record<LeadStatus, { label: string; tone: string; icon: typeof AlertTriangle; text: string }> = {
  missing: {
    label: "Fora do CRM",
    tone: "bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]",
    icon: AlertTriangle,
    text: "Este lead se cadastrou há mais de 3h30 e nenhum lead do CRM tem o mesmo telefone ou e-mail.",
  },
  pending: {
    label: "Aguardando CRM",
    tone: "bg-yellow-100 text-yellow-800",
    icon: Clock,
    text: "Chegou há menos de 3h30 — ainda pode entrar no próximo export do CRM.",
  },
  duplicate: {
    label: "Duplicado",
    tone: "bg-orange-100 text-orange-700",
    icon: Copy,
    text: "O mesmo telefone ou e-mail aparece em mais de um cadastro.",
  },
};

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-0.5 break-words text-sm text-blue-900">{value || "—"}</p>
    </div>
  );
}

export function ReconLeadDialog({
  lead,
  status,
  group,
  onClose,
  onOpenFull,
}: {
  lead: IssueLead | null;
  status: LeadStatus;
  group?: DuplicateGroup | null;
  onClose: () => void;
  onOpenFull: (leadId: string) => void;
}) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [extra, setExtra] = useState<Record<string, string | number | null>>({});
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!lead) return;
    let cancelled = false;
    setAnswers([]);
    setExtra({});
    setCandidates(null);
    const supabase = createClient();

    // Dados completos da origem.
    if (lead.source === "nativo") {
      supabase
        .from("meta_form_leads")
        .select("leadgen_id, form_id, meta_ad_id, ad_name, field_data, created_time, synced_at")
        .eq("leadgen_id", lead.id)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled || !data) return;
          setAnswers((data.field_data as Answer[]) ?? []);
          setExtra({ "Id do lead (Meta)": data.leadgen_id, "Id do formulário": data.form_id, "Id do anúncio": data.meta_ad_id, "Lido da Meta em": fmtDateTime(data.synced_at) });
        });
    } else {
      supabase
        .from("landing_page_leads")
        .select("city, state, capital_label, page_origin, utm_source, utm_medium, utm_campaign, utm_content, crm_lead_id, crm_funnel_name, crm_stage_name, crm_source, meetings_count, crm_synced_at")
        .eq("id", lead.id)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled || !data) return;
          setExtra({
            Cidade: [data.city, data.state].filter(Boolean).join(" / ") || null,
            Capital: data.capital_label || null,
            "Página da LP": data.page_origin,
            "UTM source": data.utm_source || null,
            "UTM medium": data.utm_medium || null,
            "UTM campaign": data.utm_campaign || null,
            "UTM content": data.utm_content || null,
            "Id CRM": data.crm_lead_id,
            "Funil CRM": data.crm_funnel_name,
            "Etapa CRM": data.crm_stage_name,
            "Origem no CRM": data.crm_source,
            Reuniões: data.meetings_count,
            "Atualizado pelo CRM": data.crm_synced_at ? fmtDateTime(data.crm_synced_at) : null,
          });
        });
    }

    // Diagnóstico: procura no CRM algo parecido (fim do telefone, e-mail ou nome),
    // pra separar "não chegou" de "chegou com dado diferente".
    const last8 = onlyDigits(lead.phone).slice(-8);
    const email = lead.email.trim();
    const tokens = lead.name.trim().split(/\s+/).filter((t) => t.length > 2);
    const base = () =>
      supabase
        .from("landing_page_leads")
        .select("id, name, phone, email, crm_lead_id, crm_stage_name, crm_funnel_name, received_at")
        .not("crm_lead_id", "is", null)
        .limit(5);
    const queries: [string, PromiseLike<{ data: Omit<Candidate, "reasons">[] | null }>][] = [];
    if (last8.length === 8) queries.push(["telefone parecido", base().like("phone_digits", `%${last8}`)]);
    if (email.includes("@")) queries.push(["mesmo e-mail", base().ilike("email", email)]);
    if (tokens.length >= 2) queries.push(["nome parecido", base().ilike("name", `%${tokens[0]}%${tokens[tokens.length - 1]}%`)]);

    Promise.all(queries.map(([, q]) => q)).then((results) => {
      if (cancelled) return;
      const byId = new Map<string, Candidate>();
      results.forEach((r, i) => {
        for (const row of r.data ?? []) {
          if (row.id === lead.id) continue;
          const c = byId.get(row.id) ?? { ...row, reasons: [] };
          c.reasons.push(queries[i][0]);
          byId.set(row.id, c);
        }
      });
      setCandidates([...byId.values()].sort((a, b) => b.reasons.length - a.reasons.length));
    });

    return () => {
      cancelled = true;
    };
  }, [lead]);

  if (!lead) return null;
  const st = STATUS[status];
  const wa = whatsappUrl(lead.phone);

  function copy(label: string, value: string) {
    void navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <Dialog open={!!lead} onClose={onClose} size="xl">
      <DialogHeader title={lead.name || "Lead sem nome"} subtitle={`${SOURCE_LABEL[lead.source]} · recebido em ${fmtDateTime(lead.at)} (${ageLabel(lead.at)})`} onClose={onClose} />
      <DialogBody className="space-y-5">
        <div className={cn("flex items-start gap-3 rounded-2xl p-4", st.tone)}>
          <st.icon className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">{st.label}</p>
            <p className="text-sm opacity-90">{st.text}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500"><Phone className="h-3.5 w-3.5" /> Telefone</p>
            <p className="mt-1 font-semibold text-blue-900">{lead.phone || "—"}</p>
            <div className="mt-2 flex gap-2">
              {lead.phone && (
                <button type="button" onClick={() => copy("phone", lead.phone)} className="text-xs font-semibold text-gray-600 hover:text-blue-900">
                  {copied === "phone" ? "Copiado!" : "Copiar"}
                </button>
              )}
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--color-success)] hover:underline">
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-100 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500"><Mail className="h-3.5 w-3.5" /> E-mail</p>
            <p className="mt-1 truncate font-semibold text-blue-900" title={lead.email}>{lead.email || "—"}</p>
            {lead.email && (
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => copy("email", lead.email)} className="text-xs font-semibold text-gray-600 hover:text-blue-900">
                  {copied === "email" ? "Copiado!" : "Copiar"}
                </button>
                <a href={`mailto:${lead.email}`} className="text-xs font-semibold text-gray-600 hover:text-blue-900">Enviar e-mail</a>
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-gray-100 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500"><FileText className="h-3.5 w-3.5" /> {lead.source === "nativo" ? "Anúncio" : "Página"}</p>
            <p className="mt-1 line-clamp-3 text-sm font-semibold text-blue-900" title={lead.origin}>{lead.origin || "—"}</p>
          </div>
        </div>

        {answers.length > 0 && (
          <section>
            <h3 className="mb-2 font-display text-sm font-semibold text-blue-900">Respostas do formulário</h3>
            <div className="grid gap-3 rounded-2xl bg-gray-050 p-4 sm:grid-cols-2">
              {answers.map((a) => (
                <Field key={a.name} label={prettyField(a.name)} value={(a.values ?? []).join(", ").replace(/_/g, " ")} />
              ))}
            </div>
          </section>
        )}

        {Object.values(extra).some((v) => v != null && v !== "") && (
          <section>
            <h3 className="mb-2 font-display text-sm font-semibold text-blue-900">Detalhes</h3>
            <div className="grid gap-3 rounded-2xl bg-gray-050 p-4 sm:grid-cols-3">
              {Object.entries(extra)
                .filter(([, v]) => v != null && v !== "")
                .map(([k, v]) => (
                  <Field key={k} label={k} value={String(v)} />
                ))}
            </div>
          </section>
        )}

        {group && (
          <section>
            <h3 className="mb-2 font-display text-sm font-semibold text-blue-900">Cadastros do mesmo contato ({group.leads.length})</h3>
            <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
              {group.leads.map((l) => (
                <li key={l.id} className={cn("flex items-center justify-between gap-3 px-4 py-2.5 text-sm", l.id === lead.id && "bg-yellow-50")}>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-blue-900">{l.name || "Sem nome"} {l.id === lead.id && <span className="text-xs font-normal text-gray-500">(este)</span>}</span>
                    <span className="block truncate text-xs text-gray-500">{[l.phone, l.email, l.crm_lead_id && `CRM ${l.crm_lead_id}`].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-gray-500">
                    {l.crm_stage && <span className="block font-semibold text-blue-900">{l.crm_stage}</span>}
                    {fmtDateTime(l.at)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {status !== "duplicate" && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 font-display text-sm font-semibold text-blue-900"><Search className="h-4 w-4" /> Procurando no CRM</h3>
            {candidates === null ? (
              <p className="text-sm text-gray-500">Buscando correspondências…</p>
            ) : candidates.length === 0 ? (
              <div className="flex items-center gap-2 rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-600">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[color:var(--color-danger)]" />
                Nada parecido no CRM (telefone, e-mail ou nome). O lead provavelmente não foi enviado — cadastre manualmente.
              </div>
            ) : (
              <>
                <p className="mb-2 text-xs text-gray-500">Parecidos no CRM — pode ser o mesmo lead com telefone ou e-mail digitado diferente:</p>
                <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
                  {candidates.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => onOpenFull(c.id)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-gray-050">
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-blue-900">{c.name || "Sem nome"}</span>
                          <span className="block truncate text-xs text-gray-500">{[c.phone, c.email].filter(Boolean).join(" · ")}</span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            {c.reasons.map((r) => (
                              <span key={r} className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-800">{r}</span>
                            ))}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-xs text-gray-500">
                          <span className="block font-semibold text-blue-900">{c.crm_stage_name || "—"}</span>
                          {c.crm_funnel_name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4">
          <span className="flex items-center gap-2 text-xs text-gray-500">
            <SourceBadge source={lead.source} />
            {lead.crm_lead_id ? (
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--color-success)]" /> CRM {lead.crm_lead_id}</span>
            ) : null}
          </span>
          {lead.source !== "nativo" && (
            <Button size="sm" variant="secondary" onClick={() => onOpenFull(lead.id)}>
              <ExternalLink className="h-4 w-4" /> Ficha completa
            </Button>
          )}
        </div>
      </DialogBody>
    </Dialog>
  );
}
