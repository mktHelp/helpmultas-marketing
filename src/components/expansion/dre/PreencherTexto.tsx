"use client";

import { useState } from "react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { DreInput } from "@/lib/expansion/dre";
import { lerTexto, type Leitura } from "@/lib/expansion/insights";

/**
 * Preenchimento rápido por texto livre ("300 contatos no whatsapp, 8 parceiros, aluguel de 2 mil").
 * A leitura é local (palavras-chave), sem IA externa: mostra o que entendeu e só aplica após conferir.
 */
export function PreencherTexto({ S, onApply }: { S: DreInput; onApply: (patch: Partial<DreInput>) => void }) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [leitura, setLeitura] = useState<Leitura | null>(null);

  function aplicar() {
    if (!leitura?.entendido.length) return;
    onApply(leitura.patch);
    setTexto("");
    setLeitura(null);
    setOpen(false);
  }

  return (
    <Card className="print:hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-500 text-blue-900"><Sparkles className="h-4 w-4" /></span>
        <span className="flex-1">
          <span className="block font-display text-base font-semibold text-blue-900">Preencher por texto</span>
          <span className="block text-xs text-gray-500">Escreva do jeito que o lead falou e eu separo nos campos.</span>
        </span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-gray-500 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-gray-100 px-5 pb-5 pt-4">
          <textarea
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setLeitura(null);
            }}
            rows={3}
            placeholder="Ex.: tenho 300 contatos no whatsapp e 150 no instagram, consigo 8 parceiros, ticket de 1500, aluguel de 2 mil"
            className="w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm text-blue-900 outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30"
          />
          {!leitura && (
            <button type="button" disabled={!texto.trim()} onClick={() => setLeitura(lerTexto(texto, S))} className="inline-flex h-9 items-center rounded-full bg-blue-900 px-4 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-40">
              Entender
            </button>
          )}
          {leitura && (
            <div className="space-y-3">
              {leitura.entendido.length ? (
                <>
                  <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                    {leitura.entendido.map((x) => (
                      <li key={x.campo} className="flex items-center justify-between gap-3 px-3.5 py-2 text-sm">
                        <span className="text-gray-600">{x.campo}</span>
                        <b className="text-blue-900">{x.valor}</b>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={aplicar} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-yellow-500 px-4 text-xs font-bold text-blue-900 hover:bg-yellow-400">
                      <Check className="h-3.5 w-3.5" /> Aplicar na simulação
                    </button>
                    <span className="text-xs text-gray-500">Só os campos acima mudam.</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">Não encontrei valores que eu reconheça. Use números junto da palavra (ex.: “300 contatos no whatsapp”, “aluguel de 2 mil”).</p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
