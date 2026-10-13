"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";
import { createClient } from "@/lib/supabase/client";
import type { LeadRow } from "@/lib/services/meta-ads";
import { cn } from "@/lib/utils";

// Modal de detalhes do lead — o mesmo nas abas Leads e Reuniões: contato, anúncio
// de origem (com preview), dados do CRM, reuniões, histórico de etapas e UTMs.

interface FullLead extends LeadRow {
  crm_lead_id: string | null;
  crm_locked: boolean;
  crm_funnel_name: string | null;
  crm_stage_name: string | null;
  crm_previous_stage_name: string | null;
  crm_phase_name: string | null;
  crm_category_name: string | null;
  crm_source: string | null;
  crm_stage_entered_at: string | null;
  crm_last_movement_at: string | null;
  crm_synced_at: string | null;
  meetings_count: number;
  meetings_no_show: number;
  meetings_rescheduled: number;
  first_meeting_at: string | null;
  last_meeting_at: string | null;
  last_meeting_status: string | null;
}

interface StageHistoryRow {
  id: string;
  stage_name: string;
  previous_stage_name: string | null;
  phase_name: string | null;
  entered_at: string;
}

const LEAD_SELECT =
  "*, matched_ad:meta_ads(id, meta_ad_id, name, adset:meta_ad_sets(id, name, campaign:meta_campaigns(id, name))), matched_adset:meta_ad_sets!matched_adset_id(id, name), matched_campaign:meta_campaigns!matched_campaign_id(id, name)";

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export const MATCHED_BY_LABEL: Record<string, string> = {
  ad_id: "por ID do anúncio",
  ad_name: "por nome do anúncio",
  adset_id: "por ID do conjunto",
  adset_name: "por nome do conjunto",
  campaign_id: "por ID da campanha",
  campaign_name: "por nome da campanha",
};

export function one<T>(v: T | T[] | null | undefined): T | null {
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

export function linkedEntities(lead: LeadRow) {
  const ad = one(lead.matched_ad);
  const adset = one(ad?.adset) ?? one(lead.matched_adset);
  const campaign = one(one(ad?.adset)?.campaign) ?? one(lead.matched_campaign);
  return { ad, adset, campaign };
}

// Página da LP onde o formulário foi preenchido — NÃO é utm_source (origem do tráfego).
export const PAGE_ORIGIN_LABEL: Record<string, string> = {
  home: "Home",
  evento: "Evento",
  // Leads do formulário nativo da Meta (campanhas FORMS II), enviados pelo n8n.
  forms: "Formulário nativo",
  // Leads que entraram direto pelo CRM (webhook leads.export).
  crm: "CRM",
};

export function pageOriginLabel(value: string) {
  return PAGE_ORIGIN_LABEL[value] ?? (value ? value.charAt(0).toUpperCase() + value.slice(1) : "—");
}

export const UTM_COLUMNS: { key: "utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term" | "utm_id"; width: string }[] = [
  { key: "utm_source", width: "min-w-28" },
  { key: "utm_medium", width: "min-w-28" },
  { key: "utm_campaign", width: "min-w-44" },
  { key: "utm_content", width: "min-w-44" },
  { key: "utm_term", width: "min-w-44" },
  { key: "utm_id", width: "min-w-44" },
];

function DetailField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase text-gray-500">{label}</p>
      <p className={cn("break-all text-sm text-blue-900", mono && "font-mono text-xs")}>
        {value ? value : <span className="text-gray-300">—</span>}
      </p>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 border-b border-gray-100 pb-1 text-xs font-bold uppercase tracking-wide text-gray-400">{title}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

interface AdPreviewState {
  url: string | null;
  loading: boolean;
  error: string | null;
}

// Preview oficial da Meta (iframe) pelo ID do anúncio na Meta, via
// /api/meta-ads/preview — o token da Meta fica só no servidor.
export function useAdPreview(metaAdId: string | null | undefined): AdPreviewState {
  const [preview, setPreview] = useState<AdPreviewState>({ url: null, loading: false, error: null });

  useEffect(() => {
    if (!metaAdId) {
      setPreview({ url: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setPreview({ url: null, loading: true, error: null });
    fetch(`/api/meta-ads/preview?metaAdId=${encodeURIComponent(metaAdId)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erro ao gerar preview");
        if (!cancelled) setPreview({ url: json.previewUrl, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setPreview({ url: null, loading: false, error: err instanceof Error ? err.message : "Erro desconhecido" });
      });
    return () => {
      cancelled = true;
    };
  }, [metaAdId]);

  return preview;
}

export function LeadDetailDialog({ leadId, onClose, actions }: { leadId: string | null; onClose: () => void; actions?: React.ReactNode }) {
  const [lead, setLead] = useState<FullLead | null>(null);
  const [history, setHistory] = useState<StageHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Sempre busca o lead completo: as duas abas (Leads e Reuniões) abrem este mesmo
  // modal, e cada uma lista só parte das colunas.
  useEffect(() => {
    if (!leadId) {
      setLead(null);
      setHistory([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLead(null);
    const supabase = createClient();
    Promise.all([
      supabase.from("landing_page_leads").select(LEAD_SELECT).eq("id", leadId).single(),
      supabase.from("crm_lead_stage_history").select("id, stage_name, previous_stage_name, phase_name, entered_at").eq("lead_id", leadId).order("entered_at", { ascending: false }),
    ]).then(([l, h]) => {
      if (cancelled) return;
      setLoading(false);
      setLead((l.data as unknown as FullLead) ?? null);
      setHistory((h.data as StageHistoryRow[]) ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const ad = one(lead?.matched_ad);
  const adset = one(ad?.adset) ?? one(lead?.matched_adset);
  const campaign = one(one(ad?.adset)?.campaign) ?? one(lead?.matched_campaign);
  const metaAdId = ad?.meta_ad_id;
  const preview = useAdPreview(metaAdId);

  return (
    <Dialog open={!!leadId} onClose={onClose} size="xl">
      <DialogHeader title={lead?.name || "Lead"} subtitle={lead ? `Recebido em ${formatDateTime(lead.received_at)}` : undefined} onClose={onClose} />
      <DialogBody>
        {loading && <p className="py-10 text-center text-sm text-gray-500">Carregando...</p>}
        {lead && actions && <div className="mb-4 flex flex-wrap items-center gap-2">{actions}</div>}
        {lead && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
            <div className="space-y-5">
              <DetailSection title="Origem do lead">
                <DetailField label="Página de origem (onde preencheu)" value={pageOriginLabel(lead.page_origin)} />
              </DetailSection>

              <DetailSection title="Contato">
                <DetailField label="Nome" value={lead.name} />
                <DetailField label="E-mail" value={lead.email} />
                <DetailField label="Telefone" value={lead.phone} />
                <DetailField label="Cidade / UF" value={lead.city && lead.state ? `${lead.city}/${lead.state}` : lead.city || lead.state} />
                <DetailField label="Capital para investir" value={lead.capital_label} />
                <DetailField label="Valor (capital)" value={lead.capital} />
              </DetailSection>

              <DetailSection title="Origem do anúncio">
                <DetailField label="Campanha" value={campaign?.name} />
                <DetailField label="Conjunto" value={adset?.name} />
                <DetailField label="Anúncio" value={ad?.name} />
                <DetailField label="Como foi vinculado" value={lead.matched_by ? MATCHED_BY_LABEL[lead.matched_by] ?? lead.matched_by : "Sem vínculo"} />
              </DetailSection>

              <DetailSection title={lead.crm_lead_id ? "CRM" : "CRM (lead ainda não está no CRM)"}>
                <DetailField label="Funil" value={lead.crm_funnel_name} />
                <DetailField label="Categoria" value={lead.crm_category_name} />
                <DetailField label="Etapa atual" value={lead.crm_stage_name} />
                <DetailField label="Fase" value={lead.crm_phase_name} />
                <DetailField label="Etapa anterior" value={lead.crm_previous_stage_name} />
                <DetailField label="Entrou na etapa em" value={lead.crm_stage_entered_at ? formatDateTime(lead.crm_stage_entered_at) : null} />
                <DetailField label="Último movimento" value={lead.crm_last_movement_at ? formatDateTime(lead.crm_last_movement_at) : null} />
                <DetailField label="Origem no CRM" value={lead.crm_source} />
                <DetailField label="ID no CRM" value={lead.crm_lead_id} mono />
                <DetailField label="Última sincronização" value={lead.crm_synced_at ? formatDateTime(lead.crm_synced_at) : null} />
                {lead.crm_locked && <DetailField label="Dados do CRM" value="Travados (edição manual)" />}
              </DetailSection>

              <DetailSection title="Reuniões">
                <DetailField label="Reuniões" value={lead.crm_lead_id ? String(lead.meetings_count) : null} />
                <DetailField label="No-show" value={lead.crm_lead_id ? String(lead.meetings_no_show) : null} />
                <DetailField label="Reagendadas" value={lead.crm_lead_id ? String(lead.meetings_rescheduled) : null} />
                <DetailField label="Status da última" value={lead.last_meeting_status} />
                <DetailField label="Primeira reunião" value={lead.first_meeting_at ? formatDateTime(lead.first_meeting_at) : null} />
                <DetailField label="Última reunião" value={lead.last_meeting_at ? formatDateTime(lead.last_meeting_at) : null} />
              </DetailSection>

              {history.length > 0 && (
                <section>
                  <h3 className="mb-2 border-b border-gray-100 pb-1 text-xs font-bold uppercase tracking-wide text-gray-400">Histórico de etapas</h3>
                  <ol className="space-y-1.5">
                    {history.map((h) => (
                      <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-blue-900">
                        <span>
                          <span className="font-semibold">{h.stage_name}</span>
                          {h.previous_stage_name && <span className="text-xs text-gray-500"> · veio de {h.previous_stage_name}</span>}
                        </span>
                        <span className="text-xs text-gray-500">{formatDateTime(h.entered_at)}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <DetailSection title="UTMs (como vieram na URL)">
                {UTM_COLUMNS.map((c) => (
                  <DetailField key={c.key} label={c.key} value={lead[c.key]} mono />
                ))}
              </DetailSection>

              <DetailSection title="Rastreamento Meta">
                <DetailField label="fbclid" value={lead.fbclid} mono />
                <DetailField label="fbc" value={lead.fbc} mono />
                <DetailField label="fbp" value={lead.fbp} mono />
              </DetailSection>
            </div>

            <div className="lg:w-[340px]">
              <h3 className="mb-2 border-b border-gray-100 pb-1 text-xs font-bold uppercase tracking-wide text-gray-400">Preview do anúncio</h3>
              {!metaAdId && (
                <p className="rounded-xl bg-gray-050 px-4 py-10 text-center text-sm text-gray-400">
                  Este lead não está vinculado a um anúncio específico, então não há preview.
                </p>
              )}
              {preview.loading && <p className="py-10 text-center text-sm text-gray-500">Carregando preview...</p>}
              {preview.error && <p className="py-10 text-center text-sm text-[color:var(--color-danger)]">{preview.error}</p>}
              {preview.url && (
                <iframe
                  src={preview.url}
                  className="h-[min(600px,70dvh)] w-full rounded-xl border border-gray-200"
                  title={`Preview — ${ad?.name ?? "anúncio"}`}
                />
              )}
            </div>
          </div>
        )}
      </DialogBody>
    </Dialog>
  );
}

