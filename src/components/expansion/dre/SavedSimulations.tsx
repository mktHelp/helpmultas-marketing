"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderOpen, GitCompareArrows, Loader2, Printer } from "lucide-react";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";
import { createClient } from "@/lib/supabase/client";
import { listDreSimulations, type DreSimulationRow } from "@/lib/services/dreSimulations";
import { brlShort } from "@/lib/expansion/dre";
import { ordenarSalvas, type CriterioRanking } from "@/lib/expansion/insights";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/SearchInput";

const CRITERIOS: { id: CriterioRanking; label: string }[] = [
  { id: "recentes", label: "Recentes" },
  { id: "retorno", label: "Retorno mais rápido" },
  { id: "lucro", label: "Maior lucro 36m" },
  { id: "roi", label: "Maior retorno s/ invest." },
];

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
  const [criterio, setCriterio] = useState<CriterioRanking>("recentes");
  const [sel, setSel] = useState<string[]>([]);

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
    return ordenarSalvas((rows ?? []).filter((r) => !t || r.lead_name.toLowerCase().includes(t)), criterio);
  }, [rows, q, criterio]);
  const comparar = (rows ?? []).filter((r) => sel.includes(r.id));
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 3 ? s : [...s, id]));

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogHeader title="Simulações salvas" subtitle="Abrir carrega só para você; ninguém mais é afetado." onClose={onClose} />
      <DialogBody className="space-y-3">
        <SearchInput value={q} onChange={setQ} placeholder="Buscar pelo nome do lead" className="max-w-none sm:max-w-none" />

        <div className="flex flex-wrap gap-1.5">
          {CRITERIOS.map((k) => (
            <button key={k.id} type="button" onClick={() => setCriterio(k.id)} className={cn("rounded-full px-3 py-1 text-xs font-bold transition-colors", criterio === k.id ? "bg-blue-900 text-white" : "bg-gray-100 text-gray-500 hover:text-blue-900")}>
              {k.label}
            </button>
          ))}
        </div>

        {comparar.length >= 2 && <Comparacao itens={comparar} onClear={() => setSel([])} />}

        {rows === null && !error && (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
        )}
        {error && <p className="py-6 text-center text-sm text-[color:var(--color-danger)]">{error}</p>}
        {rows !== null && filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">{rows.length === 0 ? "Nenhuma simulação salva ainda." : "Nenhum lead com esse nome."}</p>
        )}

        <div className="space-y-2">
          {filtered.map((r, pos) => {
            const busy = busyId === r.id;
            const marcado = sel.includes(r.id);
            return (
              <div key={r.id} className={cn("flex flex-wrap items-center gap-3 rounded-2xl border p-3", marcado ? "border-blue-900 bg-blue-050" : "border-gray-200")}>
                <input type="checkbox" checked={marcado} onChange={() => toggle(r.id)} disabled={!marcado && sel.length >= 3} aria-label={`Comparar ${r.lead_name}`} title="Selecione de 2 a 3 para comparar" className="h-4 w-4 shrink-0 accent-[#243746]" />
                <div className="min-w-0 flex-1 basis-44">
                  <p className="truncate font-display text-sm font-bold text-blue-900">
                    {criterio !== "recentes" && pos < 3 && <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500 text-[11px] text-blue-900">{pos + 1}</span>}
                    {r.lead_name}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {r.region} · salva em {new Date(r.updated_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>Retorno<b className="block text-sm text-blue-900">{r.summary.retornoMes ? `Mês ${r.summary.retornoMes}` : "—"}</b></span>
                  <span>Fat. líquido/mês<b className="block text-sm text-blue-900">{r.summary.resultadoMes !== undefined ? brlShort(r.summary.resultadoMes) : "—"}</b></span>
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

function Comparacao({ itens, onClear }: { itens: DreSimulationRow[]; onClear: () => void }) {
  const linhas: { label: string; get: (r: DreSimulationRow) => string; melhor?: (r: DreSimulationRow) => number | null; maior?: boolean }[] = [
    { label: "Investimento", get: (r) => (r.summary.investimento !== undefined ? brlShort(r.summary.investimento) : "—"), melhor: (r) => r.summary.investimento ?? null },
    { label: "Retorno", get: (r) => (r.summary.retornoMes ? `Mês ${r.summary.retornoMes}` : "> 36 meses"), melhor: (r) => r.summary.retornoMes ?? null },
    { label: "Faturamento líquido / mês", get: (r) => (r.summary.resultadoMes !== undefined ? brlShort(r.summary.resultadoMes) : "—"), melhor: (r) => r.summary.resultadoMes ?? null, maior: true },
    { label: "Lucro em 36 meses", get: (r) => (r.summary.lucro36m !== undefined ? brlShort(r.summary.lucro36m) : "—"), melhor: (r) => r.summary.lucro36m ?? null, maior: true },
    { label: "Retorno s/ investimento", get: (r) => (r.summary.roi36 != null ? `${r.summary.roi36.toFixed(1).replace(".", ",")}×` : "—"), melhor: (r) => r.summary.roi36 ?? null, maior: true },
    { label: "Clientes / mês", get: (r) => (r.summary.casosMes !== undefined ? r.summary.casosMes.toFixed(1).replace(".", ",") : "—"), melhor: (r) => r.summary.casosMes ?? null, maior: true },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-blue-900">
      <div className="flex items-center justify-between bg-blue-900 px-4 py-2 text-white">
        <span className="flex items-center gap-2 text-sm font-bold"><GitCompareArrows className="h-4 w-4 text-yellow-500" /> Comparação</span>
        <button type="button" onClick={onClear} className="text-xs font-semibold text-blue-100 hover:text-white">Limpar</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm text-blue-900">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-500">
              <th className="px-3 py-2 text-left font-semibold" />
              {itens.map((r) => <th key={r.id} className="px-3 py-2 text-right font-bold text-blue-900">{r.lead_name}</th>)}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const vals = itens.map((r) => (l.melhor ? l.melhor(r) : null));
              const validos = vals.filter((v): v is number => v !== null);
              // "melhor" = maior, exceto investimento e prazo de retorno, onde menor é melhor
              const alvo = validos.length > 1 ? (l.maior ? Math.max(...validos) : Math.min(...validos)) : null;
              return (
                <tr key={l.label} className="border-b border-gray-100">
                  <td className="px-3 py-2 text-xs text-gray-500">{l.label}</td>
                  {itens.map((r, i) => <td key={r.id} className={cn("px-3 py-2 text-right font-semibold", alvo !== null && vals[i] === alvo && "text-[color:var(--color-success)]")}>{l.get(r)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
