"use client";

import { Rocket, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DreInput, DreResult } from "@/lib/expansion/dre";
import { insightsEtapa } from "@/lib/expansion/insights";

/**
 * Insights da etapa em andamento, pensados para o lead que está vendo a tela:
 * números grandes e frases diretas sobre o que a franquia pode render para ele.
 */
export function InsightsCard({ step, S, c }: { step: number; S: DreInput; c: DreResult }) {
  const itens = insightsEtapa(step, S, c);
  if (!itens.length) return null;
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-blue-800 to-[#2c5a73] p-5 text-white shadow-[var(--shadow-md)] print:hidden sm:p-6">
      <div className="pointer-events-none absolute -left-10 -bottom-12 h-40 w-40 rounded-full bg-yellow-500/15 blur-3xl" aria-hidden />
      <p className="relative mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-yellow-500">
        <Sparkles className="h-4 w-4" /> Veja o que isso significa para você
      </p>
      <ul className="relative space-y-3">
        {itens.map((x) => {
          const Icon = x.tipo === "destaque" ? TrendingUp : Rocket;
          return (
            <li key={x.titulo} className={cn("rounded-2xl p-4", x.tipo === "destaque" ? "bg-white/10" : "bg-yellow-500/15 ring-1 ring-yellow-500/40")}>
              {x.valor && <p className="font-display text-3xl font-bold leading-none text-yellow-500">{x.valor}</p>}
              <p className={cn("flex items-start gap-2 text-sm font-bold", x.valor && "mt-2")}>
                {!x.valor && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />}
                {x.titulo}
              </p>
              <p className="mt-1 text-[13px] leading-snug text-blue-100">{x.texto}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
