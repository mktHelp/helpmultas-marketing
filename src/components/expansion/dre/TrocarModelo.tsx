"use client";

import { ArrowRight, Check, Home, Store } from "lucide-react";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { MODELO_LABEL, PRESETS, brl, sum, type Modelo } from "@/lib/expansion/dre";

const ICONE = { home: Home, loja: Store } as const;

/** Diálogo de troca de modelo: mostra os dois modelos lado a lado e o que muda de verdade. */
export function TrocarModelo({ open, atual, onClose, onConfirm }: { open: boolean; atual: Modelo; onClose: () => void; onConfirm: () => void }) {
  const destino: Modelo = atual === "loja" ? "home" : "loja";
  const linhas: { label: string; get: (m: Modelo) => string }[] = [
    { label: "Taxa de adesão", get: (m) => brl(PRESETS[m].invest[0].v) },
    { label: "Investimento inicial", get: (m) => brl(sum(PRESETS[m].invest)) },
    { label: "Despesas fixas / mês", get: (m) => brl(sum(PRESETS[m].desp)) },
    { label: "Taxa de processamento", get: (m) => `${PRESETS[m].royalties}%` },
  ];
  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogHeader title="Trocar de modelo" subtitle="Compare os dois modelos antes de mudar. O que você já preencheu não se perde." onClose={onClose} />
      <DialogBody className="space-y-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-3">
          {([atual, destino] as Modelo[]).map((m, i) => {
            const Icon = ICONE[m];
            const alvo = i === 1;
            return (
              <div key={m} className={cn("contents")}>
                <div className={cn("rounded-2xl border-2 p-4", alvo ? "border-yellow-500 bg-yellow-050" : "border-gray-200 bg-gray-050")}>
                  <div className="flex items-center gap-2">
                    <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", alvo ? "bg-blue-900 text-yellow-500" : "bg-white text-blue-900 ring-1 ring-gray-200")}><Icon className="h-4.5 w-4.5" /></span>
                    <div className="min-w-0">
                      <p className="font-display text-base font-bold leading-tight text-blue-900">{MODELO_LABEL[m]}</p>
                      <p className={cn("text-[11px] font-bold uppercase tracking-wide", alvo ? "text-yellow-700" : "text-gray-500")}>{alvo ? "Trocar para" : "Modelo atual"}</p>
                    </div>
                  </div>
                  <dl className="mt-3 space-y-1.5">
                    {linhas.map((l) => (
                      <div key={l.label} className="flex items-baseline justify-between gap-2 text-xs">
                        <dt className="text-gray-500">{l.label}</dt>
                        <dd className="font-bold text-blue-900">{l.get(m)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                {i === 0 && <span className="flex items-center justify-center text-blue-900"><ArrowRight className="h-5 w-5" /></span>}
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl bg-blue-050 p-4">
          <p className="mb-2 text-sm font-bold text-blue-900">O que acontece ao trocar</p>
          <ul className="space-y-2 text-sm text-blue-900">
            {[
              "Tudo o que você preencheu continua: círculo, parceiros, ticket e os valores que você alterou.",
              "Só mudam os valores que ainda estão no padrão do modelo atual (adesão, despesas e taxa viram o padrão do novo modelo).",
              "Itens que existem em só um dos modelos entram ou saem da lista, a menos que você já tenha colocado um valor neles.",
              "Você pode voltar ao modelo anterior quando quiser.",
            ].map((t) => (
              <li key={t} className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-success)]" /><span>{t}</span></li>
            ))}
          </ul>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={onConfirm}>Trocar para {MODELO_LABEL[destino]} <ArrowRight className="h-4 w-4" /></Button>
      </DialogFooter>
    </Dialog>
  );
}
