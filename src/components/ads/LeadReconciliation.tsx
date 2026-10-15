"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Clock, Copy, History, LayoutDashboard, RefreshCw, UserX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { DuplicateGroup, IssueLead } from "@/lib/lead-reconciliation";
import { FolderTabs } from "./reconciliation/FolderTabs";
import { ReconDashboard } from "./reconciliation/ReconDashboard";
import { ReconDuplicates, ReconHistory, ReconLeadList } from "./reconciliation/ReconLists";
import { ReconLeadDialog } from "./reconciliation/ReconLeadDialog";
import { ageLabel, fmtDateTime, type LeadStatus, type Run } from "./reconciliation/shared";
import { LeadDetailDialog } from "./LeadDetail";

const TABS = ["dashboard", "fora", "aguardando", "duplicados", "historico"] as const;
type Tab = (typeof TABS)[number];

/** Próximo disparo do GitHub Actions: minuto 15 das horas múltiplas de 3 (UTC). */
function nextCycle(now = new Date()) {
  const d = new Date(now);
  d.setUTCMinutes(15, 0, 0);
  while (d <= now || d.getUTCHours() % 3 !== 0) d.setUTCHours(d.getUTCHours() + 1);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

// tabParam: nome do parâmetro da URL das sub-abas ("aba" no Hub; na Expansão
// "aba" já escolhe a seção, então lá é "sub").
export function LeadReconciliation({ tabParam = "aba" }: { tabParam?: string } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab: Tab = TABS.includes(params.get(tabParam) as Tab) ? (params.get(tabParam) as Tab) : "dashboard";
  const setTab = (t: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(tabParam, t);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  const [runs, setRuns] = useState<Run[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ lead: IssueLead; status: LeadStatus; group?: DuplicateGroup } | null>(null);
  const [fullId, setFullId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await createClient()
      .from("lead_reconciliation_runs")
      .select("id, started_at, finished_at, status, error, summary, issues")
      .order("started_at", { ascending: false })
      .limit(40);
    setRuns((data ?? []) as Run[]);
    setLoaded(true);
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
  const previous = useMemo(() => {
    if (!run) return null;
    return runs.slice(runs.indexOf(run) + 1).find((r) => r.status === "success") ?? null;
  }, [runs, run]);
  const s = run?.summary ?? {};
  const missing = run?.issues?.missing ?? [];
  const pending = run?.issues?.pending ?? [];
  const duplicates = run?.issues?.duplicates ?? [];
  const isLatest = run?.id === runs[0]?.id;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-gradient-to-r from-blue-900 to-[#2f4a5e] p-4 text-white shadow-[var(--shadow-sm)] sm:px-6">
        <div className="flex items-center gap-3">
          <span className={cn("relative flex h-3 w-3", !run && "opacity-0")}>
            <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", run?.status === "error" ? "bg-red-400" : "bg-green-400")} />
            <span className={cn("relative inline-flex h-3 w-3 rounded-full", run?.status === "error" ? "bg-red-400" : "bg-green-400")} />
          </span>
          <div>
            <p className="text-sm font-semibold">
              {run ? (isLatest ? `Último ciclo ${ageLabel(run.started_at)}` : "Vendo ciclo antigo") : "Nenhum ciclo ainda"}
            </p>
            <p className="text-xs text-white/70">Roda sozinho a cada 3h · próximo às {nextCycle()} · janela de 7 dias</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-10 rounded-full border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white outline-none [&>option]:text-blue-900"
            value={run?.id ?? ""}
            onChange={(e) => setSelected(e.target.value)}
            aria-label="Ciclo"
          >
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {fmtDateTime(r.started_at)} {r.status === "error" ? "· erro" : r.status === "running" ? "· rodando" : ""}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={validateNow} disabled={running}>
            <RefreshCw className={cn("h-4 w-4", running && "animate-spin")} />
            {running ? "Validando..." : "Validar agora"}
          </Button>
        </div>
      </div>

      {runError && <p className="text-sm text-[color:var(--color-danger)]">{runError}</p>}
      {s.native_error && (
        <div className="flex items-start gap-2 rounded-2xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-blue-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
          <span>Formulário nativo não sincronizou neste ciclo ({s.native_error}). Confira o <b>META_LEADS_TOKEN</b> e se a Página está atribuída ao usuário do sistema.</span>
        </div>
      )}

      {!loaded ? (
        <div className="h-96 animate-pulse rounded-3xl bg-white/60" />
      ) : !run ? (
        <div className="rounded-3xl bg-white p-10 text-center text-sm text-gray-600">Nenhum ciclo ainda. O primeiro roda no próximo horário ou em “Validar agora”.</div>
      ) : run.status === "error" && tab !== "historico" ? (
        <div className="rounded-3xl bg-white p-10 text-center text-sm text-[color:var(--color-danger)]">Este ciclo falhou: {run.error}</div>
      ) : (
        <FolderTabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { key: "fora", label: "Fora do CRM", icon: UserX, count: missing.length, alert: true },
            { key: "aguardando", label: "Aguardando", icon: Clock, count: pending.length },
            { key: "duplicados", label: "Duplicados", icon: Copy, count: duplicates.length },
            { key: "historico", label: "Histórico", icon: History, count: runs.length },
          ]}
        >
          <div key={tab} className="ast-fade-up">
            {tab === "dashboard" && <ReconDashboard run={run} previous={previous} runs={runs} onOpen={(lead) => setOpen({ lead, status: "missing" })} />}
            {tab === "fora" && <ReconLeadList leads={missing} kind="missing" run={run} onOpen={(lead) => setOpen({ lead, status: "missing" })} />}
            {tab === "aguardando" && <ReconLeadList leads={pending} kind="pending" run={run} onOpen={(lead) => setOpen({ lead, status: "pending" })} />}
            {tab === "duplicados" && <ReconDuplicates groups={duplicates} run={run} onOpen={(lead, group) => setOpen({ lead, status: "duplicate", group })} />}
            {tab === "historico" && (
              <ReconHistory
                runs={runs}
                selected={run.id}
                onSelect={(id) => {
                  setSelected(id);
                  setTab("dashboard");
                }}
              />
            )}
          </div>
        </FolderTabs>
      )}

      <ReconLeadDialog
        lead={open?.lead ?? null}
        status={open?.status ?? "missing"}
        group={open?.group}
        onClose={() => setOpen(null)}
        onOpenFull={(id) => {
          setOpen(null);
          setFullId(id);
        }}
      />
      <LeadDetailDialog leadId={fullId} onClose={() => setFullId(null)} />
    </div>
  );
}
