"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Loader2, Printer, Search } from "lucide-react";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";
import { createClient } from "@/lib/supabase/client";
import { listDreSimulations, type DreSimulationRow } from "@/lib/services/dreSimulations";
import { brlShort } from "@/lib/expansion/dre";

/**
 * Lista das simulações salvas. Abrir/imprimir só carrega os dados NESTE navegador:
 * nada é compartilhado em tempo real, então outra pessoa mexendo numa simulação
 * (ou em outro lead) não é afetada por quem abre uma salva.
 */
export function SavedSimulations({
  open,
  onClose,
  onOpen,
  onPrint,
  busyId,
}: {
  open: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
  onPrint: (id: string) => void;
  busyId: string | null;
}) {
  const [rows, setRows] = useState<DreSimulationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRows(null);
    setError(null);
    listDreSimulations(createClient())
      .then((r) => !cancelled && setRows(r))
      .catch(() => !cancelled && setError("Não foi possível carregar as simulações salvas."));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !t || r.lead_name.toLowerCase().includes(t));
  }, [rows, q]);

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogHeader title="Simulações salvas" subtitle="Abrir carrega só para você; ninguém mais é afetado." onClose={onClose} />
      <DialogBody className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar pelo nome do lead"
            className="h-10 w-full rounded-xl border border-gray-200 pl-9 pr-3 text-sm text-blue-900 outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30"
          />
        </div>

        {rows === null && !error && (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
        )}
        {error && <p className="py-6 text-center text-sm text-[color:var(--color-danger)]">{error}</p>}
        {rows !== null && filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">{rows.length === 0 ? "Nenhuma simulação salva ainda." : "Nenhum lead com esse nome."}</p>
        )}

        <div className="space-y-2">
          {filtered.map((r) => {
            const busy = busyId === r.id;
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 p-3">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate font-display text-sm font-bold text-blue-900">{r.lead_name}</p>
                  <p className="text-[11px] text-gray-500">
                    {r.region} · salva em {new Date(r.updated_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>Retorno<b className="block text-sm text-blue-900">{r.summary.retornoMes ? `Mês ${r.summary.retornoMes}` : "—"}</b></span>
                  <span>Resultado/mês<b className="block text-sm text-blue-900">{r.summary.resultadoMes !== undefined ? brlShort(r.summary.resultadoMes) : "—"}</b></span>
                  <span>Investimento<b className="block text-sm text-blue-900">{r.summary.investimento !== undefined ? brlShort(r.summary.investimento) : "—"}</b></span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onOpen(r.id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-blue-900 px-4 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />} Abrir
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onPrint(r.id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-blue-900 px-3.5 text-xs font-bold text-blue-900 hover:bg-blue-050 disabled:opacity-50"
                  >
                    <Printer className="h-3.5 w-3.5" /> PDF
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogBody>
    </Dialog>
  );
}
