"use client";

import { useEffect, useRef, useState } from "react";
import { Check, FileUp, Loader2, Save, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type ImportStage = "upload" | "ai" | "saving";

export interface ImportState {
  fileName: string;
  stage: ImportStage;
  startedAt: number;
  /** texto que o Helpinho já escreveu (chega ao vivo quando a IA é chamada direto) */
  text: string;
  chars: number | null;
}

const STEPS: { key: ImportStage; label: string; icon: typeof FileUp }[] = [
  { key: "upload", label: "Lendo o arquivo", icon: FileUp },
  { key: "ai", label: "Helpinho analisando e organizando no padrão", icon: Sparkles },
  { key: "saving", label: "Salvando e gerando o PDF", icon: Save },
];

/** Painel grande mostrado no lugar do documento enquanto a importação roda. */
export function ImportProgress({ state }: { state: ImportState }) {
  const [now, setNow] = useState(() => Date.now());
  const textRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // acompanha o texto que vai chegando
  useEffect(() => {
    if (textRef.current) textRef.current.scrollTop = textRef.current.scrollHeight;
  }, [state.text]);

  const seconds = Math.max(0, Math.floor((now - state.startedAt) / 1000));
  const current = STEPS.findIndex((s) => s.key === state.stage);
  const preview = state.text.replace(/^\s*###\s*(T[IÍ]TULO|TIPO|CONTE[UÚ]DO)\s*$/gim, "").trim();

  return (
    <div className="ast-fade-up flex min-h-[420px] flex-col gap-4 rounded-2xl border border-yellow-300 bg-yellow-050 p-4 sm:p-5" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-900 text-yellow-400">
          <Sparkles className="h-5 w-5 animate-pulse" />
          <span className="absolute inset-0 animate-ping rounded-xl bg-yellow-400/30" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-blue-900">O Helpinho está analisando o arquivo</p>
          <p className="truncate text-xs text-blue-900/70">{state.fileName}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 font-mono text-xs font-bold text-blue-900 tabular-nums">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </span>
      </div>

      <ol className="space-y-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < current;
          const active = i === current;
          return (
            <li key={s.key} className={cn("flex items-center gap-2.5 text-sm", done ? "text-[color:var(--color-success)]" : active ? "font-bold text-blue-900" : "text-gray-400")}>
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  done ? "bg-[color:var(--color-success-bg)]" : active ? "bg-yellow-500 text-blue-900" : "bg-white"
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={3} /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
              </span>
              <span>
                {s.label}
                {s.key === "upload" && done && state.chars ? <span className="ml-1.5 font-normal text-gray-500">({state.chars.toLocaleString("pt-BR")} caracteres)</span> : null}
              </span>
            </li>
          );
        })}
      </ol>

      {state.stage === "ai" && (
        <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-yellow-200 bg-white">
          <p className="border-b border-gray-100 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
            {preview ? "Escrevendo…" : "Pensando na organização…"}
          </p>
          {preview ? (
            <pre ref={textRef} className="max-h-[320px] min-h-[160px] flex-1 overflow-y-auto whitespace-pre-wrap px-3 py-2.5 font-sans text-[13px] leading-relaxed text-blue-900">
              {preview}
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-yellow-500 align-middle" aria-hidden />
            </pre>
          ) : (
            <div className="space-y-2 p-3">
              {[90, 75, 82, 60].map((w, i) => (
                <div key={i} className="ast-skeleton h-3 rounded" style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }} />
              ))}
              {seconds > 25 && <p className="pt-1 text-xs text-gray-500">Arquivos maiores levam mais tempo. Pode continuar navegando nesta pasta.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
