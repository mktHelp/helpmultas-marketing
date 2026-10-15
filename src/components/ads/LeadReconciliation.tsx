"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Copy, RefreshCw, UserX } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { IssueLead, ReconciliationIssues, ReconciliationSummary } from "@/lib/lead-reconciliation";

interface Run {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "error";
  error: string | null;
  summary: Partial<ReconciliationSummary>;
  issues: Partial<ReconciliationIssues>;
}

const SOURCE_LABEL: Record<IssueLead["source"], string> = { lp: "LP", nativo: "Form nativo", crm: "CRM" };

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : "—";

function Stat({ label, value, hint, tone }: { label: string; value: number | string; hint?: string; tone?: "danger" | "ok" }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold text-blue-900", tone === "danger" && Number(value) > 0 && "text-[color:var(--color-danger)]")}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function LeadCells({ l }: { l: IssueLead }) {
  return (
    <>
      <td className="px-3 py-2"><Badge tone={l.source === "nativo" ? "info" : l.source === "crm" ? "neutral" : "accent"}>{SOURCE_LABEL[l.source]}</Badge></td>
      <td className="px-3 py-2 font-medium text-blue-900">{l.name || "—"}</td>
      <td className="px-3 py-2">{l.phone || "—"}</td>
      <td className="px-3 py-2">{l.email || "—"}</td>
      <td className="px-3 py-2 text-gray-600">{l.origin || "—"}</td>
      <td className="whitespace-nowrap px-3 py-2 text-gray-600">{fmt(l.at)}</td>
    </>
  );
}

const TH = ["Origem", "Nome", "Telefone", "E-mail", "Página / anúncio", "Recebido"];

export function LeadReconciliation() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState("missing");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await createClient()
      .from("lead_reconciliation_runs")
      .select("id, started_at, finished_at, status, error, summary, issues")
      .order("started_at", { ascending: false })
      .limit(24);
    setRuns((data ?? []) as Run[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function validateNow() {
    setRunning(true);
    setRunError(null);
    const res = await fetch("/api/leads/reconcile", { method: "POST" });
    if (!res.ok) setRunError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Falha ao validar");
    setSelected(null);
    await load();
    setRunning(false);
  }

  const run = runs.find((r) => r.id === selected) ?? runs[0];
  const s = run?.summary ?? {};
  const missing = run?.issues?.missing ?? [];
  const duplicates = run?.issues?.duplicates ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm"
          value={run?.id ?? ""}
          onChange={(e) => setSelected(e.target.value)}
          aria-label="Ciclo"
        >
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {fmt(r.started_at)} {r.status === "error" ? "· erro" : r.status === "running" ? "· rodando" : ""}
            </option>
          ))}
        </select>
        <Button size="sm" variant="secondary" onClick={validateNow} disabled={running}>
          <RefreshCw className={cn("h-4 w-4", running && "animate-spin")} />
          {running ? "Validando..." : "Validar agora"}
        </Button>
        {runError && <span className="text-sm text-[color:var(--color-danger)]">{runError}</span>}
      </div>

      {!run ? (
        <Card><CardBody><p className="text-sm text-gray-600">Nenhum ciclo ainda. O primeiro roda no próximo horário (a cada 3h) ou em “Validar agora”.</p></CardBody></Card>
      ) : run.status === "error" ? (
        <Card><CardBody><p className="text-sm text-[color:var(--color-danger)]">Ciclo falhou: {run.error}</p></CardBody></Card>
      ) : (
        <>
          {s.native_error && (
            <div className="flex items-start gap-2 rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-blue-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
              <span>Formulário nativo não sincronizou neste ciclo ({s.native_error}). Verifique se o token da Meta tem a permissão <b>leads_retrieval</b>.</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="LP fora do CRM" value={s.lp_missing ?? 0} hint={`${s.lp_in_crm ?? 0} de ${s.lp_total ?? 0} no CRM · ${s.lp_pending ?? 0} aguardando`} tone="danger" />
            <Stat label="Nativo fora do CRM" value={s.native_missing ?? 0} hint={`${s.native_in_crm ?? 0} de ${s.native_total ?? 0} no CRM · ${s.native_pending ?? 0} aguardando`} tone="danger" />
            <Stat label="Duplicados LP / nativo" value={(s.dup_lp ?? 0) + (s.dup_native ?? 0)} hint={`${s.dup_lp ?? 0} LP · ${s.dup_native ?? 0} nativo`} />
            <Stat label="Duplicados no CRM" value={s.dup_crm ?? 0} hint="mesmo telefone/e-mail, ids diferentes" />
          </div>
          <p className="text-xs text-gray-500">
            Janela: últimos 7 dias · ciclo de {fmt(run.started_at)} · “aguardando” = recebido há menos de 3h30, ainda pode vir no próximo export do CRM.
          </p>

          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Divergências</CardTitle>
              <Tabs
                active={tab}
                onChange={setTab}
                tabs={[
                  { key: "missing", label: "Fora do CRM", count: missing.length, icon: UserX },
                  { key: "dups", label: "Duplicados", count: duplicates.length, icon: Copy },
                ]}
              />
            </CardHeader>
            <CardBody className="overflow-x-auto p-0">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>{tab === "dups" && <th className="px-3 py-2">Grupo</th>}{TH.map((h) => <th key={h} className="px-3 py-2">{h}</th>)}{tab === "dups" && <th className="px-3 py-2">Etapa CRM</th>}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tab === "missing" &&
                    (missing.length ? missing.map((l) => <tr key={`${l.source}-${l.id}`}><LeadCells l={l} /></tr>) : (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">Nenhum lead fora do CRM 🎉</td></tr>
                    ))}
                  {tab === "dups" &&
                    (duplicates.length ? duplicates.flatMap((g, gi) =>
                      g.leads.map((l, i) => (
                        <tr key={`${gi}-${l.id}`} className={cn(gi % 2 === 1 && "bg-gray-50/60")}>
                          <td className="px-3 py-2 text-xs text-gray-500">{i === 0 ? `#${gi + 1} · ${g.leads.length}x` : ""}</td>
                          <LeadCells l={l} />
                          <td className="px-3 py-2 text-gray-600">{l.crm_stage || "—"}</td>
                        </tr>
                      )),
                    ) : (
                      <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">Nenhum duplicado</td></tr>
                    ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
