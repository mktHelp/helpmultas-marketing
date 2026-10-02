"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, FileSearch, Loader2, MessageSquare, Mic, MicOff, Sparkles, Wand2 } from "lucide-react";
import { useSpeechRecognition } from "@/lib/hooks/useSpeechRecognition";
import { cn } from "@/lib/utils";

type Mode = "generate" | "review";

interface AiResult {
  mode: Mode;
  text: string;
  notes?: string;
}

const DURATIONS = [
  { value: 30, label: "30s" },
  { value: 60, label: "1 min" },
  { value: 90, label: "1:30" },
  { value: 120, label: "2 min" },
];

export function AiPanel({
  scriptId,
  getFullText,
  getSelectionText,
  onUse,
  onOpenChat,
  className,
  contextLabel,
}: {
  scriptId: string | null;
  getFullText: () => string;
  getSelectionText: () => string;
  /** Aplica o texto no editor. `replaceSelection` = substitui o trecho selecionado (ou acrescenta, se não havia seleção). */
  onUse: (text: string, replaceSelection: boolean) => void;
  /** leva o roteiro atual para uma conversa com o Helpinho no chat */
  onOpenChat?: () => void;
  className?: string;
  /** linha de contexto no cabeçalho (ex.: título do roteiro aberto) */
  contextLabel?: string;
}) {
  const [mode, setMode] = useState<Mode>("generate");
  const [brief, setBrief] = useState("");
  const [instruction, setInstruction] = useState("");
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Texto que a revisão usou (seleção ou tudo), para saber como aplicar depois.
  const [reviewedSelection, setReviewedSelection] = useState(false);

  const onFinalSpeech = useCallback((text: string) => {
    setBrief((prev) => (prev ? `${prev.trimEnd()} ${text}` : text));
  }, []);
  const speech = useSpeechRecognition(onFinalSpeech);

  async function run(nextMode: Mode) {
    if (loading) return;
    if (speech.listening) speech.stop();

    let script = "";
    let usedSelection = false;
    if (nextMode === "review") {
      const selection = getSelectionText();
      usedSelection = selection.length > 0;
      script = usedSelection ? selection : getFullText();
      if (!script.trim()) {
        toast.error("Escreva ou cole um roteiro no editor para revisar.");
        return;
      }
    } else if (!brief.trim()) {
      toast.error("Conte do que é o vídeo (digite ou use o microfone).");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/teleprompter/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: nextMode,
          brief,
          script,
          instruction,
          durationSeconds: duration,
          scriptId: scriptId ?? undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.text !== "string") throw new Error(data?.error || "Não foi possível falar com a IA.");
      setReviewedSelection(usedSelection);
      setResult({ mode: nextMode, text: data.text, notes: data.notes || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao falar com a IA.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  function use() {
    if (!result) return;
    // Geração: acrescenta/substitui a seleção. Revisão: substitui o trecho revisado.
    onUse(result.text, result.mode === "review" ? reviewedSelection : true);
    toast.success(result.mode === "review" ? "Revisão aplicada no editor" : "Roteiro inserido no editor");
    setResult(null);
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white", className)}>
      <div className="flex items-center gap-2 bg-gradient-to-r from-blue-900 to-blue-800 px-4 py-3 text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500 text-blue-900">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="font-display text-sm font-bold">Helpinho</p>
          <p className="truncate text-[11px] text-blue-100">{contextLabel ?? "Escreve e revisa roteiros no estilo do Rober"}</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-100 p-2">
        {([
          { key: "generate", label: "Gerar roteiro", icon: Wand2 },
          { key: "review", label: "Revisar", icon: FileSearch },
        ] as const).map((t) => {
          const Icon = t.icon;
          const active = mode === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setMode(t.key);
                setResult(null);
                setError(null);
              }}
              aria-pressed={active}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-all sm:py-2 sm:text-xs",
                active ? "bg-blue-900 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {mode === "generate" ? (
          <>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="ai-brief" className="text-xs font-bold text-gray-700">Sobre o que é o vídeo?</label>
                {speech.supported && (
                  <button
                    type="button"
                    onClick={speech.listening ? speech.stop : speech.start}
                    aria-pressed={speech.listening}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold transition-all active:scale-95 sm:px-3 sm:py-1 sm:text-xs",
                      speech.listening ? "bg-[color:var(--color-danger)] text-white" : "bg-yellow-500 text-blue-900 hover:bg-yellow-400"
                    )}
                  >
                    {speech.listening ? <MicOff className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> : <Mic className="h-4 w-4 sm:h-3.5 sm:w-3.5" />}
                    {speech.listening ? "Parar" : "Falar"}
                    {speech.listening && <span className="ast-dot ml-0.5 h-1.5 w-1.5 rounded-full bg-white" aria-hidden />}
                  </button>
                )}
              </div>
              <textarea
                id="ai-brief"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={6}
                placeholder="Ex: explicar o que fazer quando recebo uma multa de excesso de velocidade e o prazo para recorrer…"
                className={cn(
                  "w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-blue-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-900 focus:shadow-[var(--shadow-focus)]",
                  speech.listening ? "border-[color:var(--color-danger)]" : "border-gray-200"
                )}
                style={{ fontSize: 16 }}
              />
              {speech.listening && (
                <p className="mt-1 text-xs italic text-gray-500" aria-live="polite">
                  {speech.interim || "Ouvindo… pode falar."}
                </p>
              )}
              {speech.error && <p className="mt-1 text-xs font-semibold text-[color:var(--color-danger)]">{speech.error}</p>}
              {!speech.supported && (
                <p className="mt-1 text-[11px] text-gray-400">Ditado por voz disponível no Chrome e no Edge.</p>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-xs font-bold text-gray-700">Duração aproximada</p>
              <div className="flex gap-1.5">
                {DURATIONS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDuration(d.value)}
                    aria-pressed={duration === d.value}
                    className={cn(
                      "flex-1 rounded-full border px-2 py-2.5 text-sm font-bold transition-all active:scale-95 sm:py-1.5 sm:text-xs",
                      duration === d.value ? "border-transparent bg-yellow-500 text-blue-900" : "border-gray-200 text-gray-600 hover:bg-gray-050"
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="rounded-xl bg-blue-050 px-3 py-2.5 text-xs text-blue-800">
            O Helpinho revisa o roteiro do editor no estilo do Rober. Se houver um trecho <strong>selecionado</strong>, revisa só ele; senão, o roteiro inteiro.
          </p>
        )}

        <div>
          <label htmlFor="ai-instruction" className="mb-1.5 block text-xs font-bold text-gray-700">
            Orientação extra <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <input
            id="ai-instruction"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={mode === "generate" ? "Ex: tom mais bem-humorado, falar com franqueados" : "Ex: deixar mais curto e direto"}
            className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-blue-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-900 focus:shadow-[var(--shadow-focus)]"
            style={{ fontSize: 16 }}
          />
        </div>

        <button
          type="button"
          onClick={() => run(mode)}
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-yellow-500 font-display text-sm font-semibold sm:h-11 text-blue-900 shadow-sm transition-all hover:bg-yellow-600 active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "generate" ? <Wand2 className="h-4 w-4" /> : <FileSearch className="h-4 w-4" />}
          {loading ? "Helpinho está escrevendo…" : mode === "generate" ? "Gerar roteiro" : "Revisar roteiro"}
        </button>

        {loading && (
          <div className="space-y-2" role="status" aria-label="A IA está trabalhando">
            {[100, 92, 78, 96, 60].map((w, i) => (
              <div key={i} className="ast-skeleton h-3 rounded-full" style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        )}

        {error && (
          <p className="ast-pop rounded-xl bg-[color:var(--color-danger-bg)] px-3 py-2 text-xs font-semibold text-[color:var(--color-danger)]">{error}</p>
        )}

        {result && (
          <div className="ast-fade-up space-y-2.5">
            <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-yellow-300 bg-yellow-050 px-3.5 py-3 text-sm leading-relaxed text-blue-900">
              {result.text}
            </div>
            {result.notes && (
              <div className="rounded-xl bg-blue-050 px-3.5 py-2.5 text-xs text-blue-800">
                <p className="mb-1 font-bold">O que mudou</p>
                <p className="whitespace-pre-wrap">{result.notes}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={use}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-blue-900 px-4 text-xs font-bold text-white transition-all hover:bg-blue-800 active:scale-95"
              >
                <Check className="h-3.5 w-3.5" />
                {result.mode === "review" ? (reviewedSelection ? "Substituir trecho" : "Substituir roteiro") : "Inserir no editor"}
              </button>
              <button
                type="button"
                onClick={copy}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-blue-900 px-3 text-xs font-bold text-blue-900 transition-all hover:bg-blue-050 active:scale-95"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
              <button
                type="button"
                onClick={() => run(result.mode)}
                disabled={loading}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-gray-600 transition-all hover:bg-gray-100 active:scale-95"
              >
                Gerar outra
              </button>
            </div>
          </div>
        )}
      </div>

      {onOpenChat && (
        <div className="border-t border-gray-100 p-2.5">
          <button
            type="button"
            onClick={onOpenChat}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-xs font-bold text-blue-800 transition-colors hover:bg-blue-050"
          >
            <MessageSquare className="h-3.5 w-3.5" /> Continuar no chat do Helpinho
          </button>
        </div>
      )}
    </div>
  );
}
