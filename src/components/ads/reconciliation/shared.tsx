"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { exportLeadsPdf, exportLeadsXlsx, type LeadExportData } from "@/lib/export-leads";
import type { IssueLead, ReconciliationIssues, ReconciliationSummary } from "@/lib/lead-reconciliation";

export interface Run {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "error";
  error: string | null;
  summary: Partial<ReconciliationSummary>;
  issues: Partial<ReconciliationIssues>;
}

export type LeadStatus = "missing" | "pending" | "duplicate";

export const SOURCE_LABEL: Record<IssueLead["source"], string> = { lp: "LP", nativo: "Form nativo", crm: "CRM" };

export function SourceBadge({ source }: { source: IssueLead["source"] }) {
  return <Badge tone={source === "nativo" ? "info" : source === "crm" ? "neutral" : "accent"}>{SOURCE_LABEL[source]}</Badge>;
}

export const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : "—";

/** "há 2 d 4 h" — quanto tempo o lead está sem chegar no CRM. */
export function ageLabel(iso: string, now = Date.now()) {
  const h = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 3_600_000));
  if (h < 1) return "agora";
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `há ${d} d ${h % 24} h` : `há ${d} d`;
}

export const onlyDigits = (v: string) => v.replace(/\D/g, "");

/** Link do WhatsApp com DDI 55 quando o número vem sem. */
export function whatsappUrl(phone: string) {
  const d = onlyDigits(phone);
  if (d.length < 10) return null;
  return `https://wa.me/${d.startsWith("55") && d.length > 11 ? d : `55${d}`}`;
}

export function ExportButtons({ build, disabled }: { build: () => LeadExportData; disabled?: boolean }) {
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);
  async function run(kind: "pdf" | "xlsx") {
    setBusy(kind);
    try {
      const data = build();
      await (kind === "pdf" ? exportLeadsPdf(data) : exportLeadsXlsx(data));
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="flex gap-2">
      {(["xlsx", "pdf"] as const).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => run(k)}
          disabled={disabled || busy !== null}
          title={`Exportar em ${k.toUpperCase()}`}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-gray-200 px-4 text-xs font-semibold text-blue-900 transition-colors hover:border-blue-900 disabled:opacity-40"
        >
          {busy === k ? <Download className="h-4 w-4 animate-pulse" /> : k === "pdf" ? <FileText className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}
          {k.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export const LEAD_COLUMNS = ["Origem", "Nome", "Telefone", "E-mail", "Página / anúncio", "Recebido em", "Tempo fora"];
export const leadRow = (l: IssueLead): string[] => [
  SOURCE_LABEL[l.source],
  l.name || "—",
  l.phone || "—",
  l.email || "—",
  l.origin || "—",
  fmtDateTime(l.at),
  ageLabel(l.at),
];
