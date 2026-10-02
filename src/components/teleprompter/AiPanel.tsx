"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight, Check, Copy, FilePlus2, FileSearch, Leaf, Loader2, Megaphone, MessageSquare, Mic, MicOff, PenLine, Play,
  RotateCcw, Sparkles, Wand2,
} from "lucide-react";
import { useSpeechRecognition } from "@/lib/hooks/useSpeechRecognition";
import { cn } from "@/lib/utils";
import type { TeleprompterFolder } from "@/types/database";

type Mode = "generate" | "review";
type Purpose = "organico" | "anuncio";

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

/** Título sugerido a partir do pedido: as primeiras palavras, com a inicial maiúscula. */
function suggestTitle(brief: string) {
  const words = brief.replace(/\s+/g, " ").trim().split(" ").slice(0, 7).join(" ");
  if (!words) return "Novo roteiro";
  const title = words.charAt(0).toUpperCase() + words.slice(1);
  return title.length > 60 ? `${title.slice(0, 57)}…` : title;
}

export function AiPanel({
  scriptId,
  folders,
  defaultFolderId,
  canInsert,
  insertLabel,
  getFullText,
  getSelectionText,
  onUse,
  onSaveNew,
  onOpenStage,
  onOpenEditor,
  onOpenChat,
  className,
  contextLabel,
}: {
  scriptId: string | null;
  folders: TeleprompterFolder[];
  defaultFolderId: string | null;
  /** há um roteiro aberto no editor onde o texto pode ser inserido */
  canInsert: boolean;
  insertLabel: string;
  getFullText: () => string;
  getSelectionText: () => string;
  /** Aplica o texto no editor. `replaceSelection` = substitui o trecho selecionado (ou acrescenta, se não havia seleção). */
  onUse: (text: string, replaceSelection: boolean) => void;
  /** Cria um roteiro novo já salvo. Devolve true se deu certo. */
  onSaveNew: (input: { title: string; text: string; folderId: string | null }) => Promise<boolean>;
  onOpenStage: (text: string) => void;
  onOpenEditor: () => void;
  /** leva o roteiro atual para uma conversa com o Helpinho no chat */
  onOpenChat?: () => void;
  className?: string;
  contextLabel?: string;
}) {
  const [mode, setMode] = useState<Mode>("generate");
  const [purpose, setPurpose] = useState<Purpose>("organico");
  const [brief, setBrief] = useState("");
  const [instruction, setInstruction] = useState("");
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reviewedSelection, setReviewedSelection] = useState(false);

  // salvar como novo
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ title: string; text: string; folderName: string | null } | null>(null);

  useEffect(() => {
    setFolderId(defaultFolderId);
  }, [defaultFolderId]);

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
    setSaved(null);
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
          purpose,
          scriptId: scriptId ?? undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.text !== "string") throw new Error(data?.error || "Não foi possível falar com a IA.");
      setReviewedSelection(usedSelection);
      setResult({ mode: nextMode, text: data.text, notes: data.notes || undefined });
      if (nextMode === "generate") setTitle(suggestTitle(brief));
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

  function useInOpenScript() {
    if (!result) return;
    onUse(result.text, result.mode === "review" ? reviewedSelection : true);
    toast.success(result.mode === "review" ? "Revisão aplicada no editor" : "Roteiro inserido no editor");
    setResult(null);
  }

  async function saveAsNew() {
    if (!result || saving) return;
    const finalTitle = title.trim() || suggestTitle(brief);
    setSaving(true);
    const ok = await onSaveNew({ title: finalTitle, text: result.text, folderId });
    setSaving(false);
    if (!ok) return;
    setSaved({ title: finalTitle, text: result.text, folderName: folders.find((f) => f.id === folderId)?.name ?? null });
    setResult(null);
    setBrief("");
    setInstruction("");
  }

  const isGenerate = mode === "generate";

  return (
    <div className={cn("flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white", className)}>
      <div className="flex items-center gap-2 bg-gradient-to-r from-blue-900 to-blue-800 px-4 py-3 text-white">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-500 text-blue-900">
          <Sparkles className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="font-display text-sm font-bold">Helpinho</p>
          <p className="truncate text-[11px] text-blue-100">{contextLabel ?? "Escreve e revisa roteiros no estilo do Rober"}</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-100 p-2">
        {([
          { key: "generate", label: "Criar roteiro", icon: Wand2 },
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
                setSaved(null);
              }}
              aria-pressed={active}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-all sm:py-2 sm:text-xs",
                active ? "bg-blue-900 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {saved ? (
          /* ---- Sucesso: roteiro criado ---- */
          <div className="ast-fade-up space-y-3 rounded-2xl border border-[color:var(--color-success)]/30 bg-[color:var(--color-success-bg)] p-4">
            <div className="flex items-start gap-3">
              <span className="ast-pop flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-success)] text-white">
                <Check className="h-5 w-5" strokeWidth={3} />
              </span>
              <div className="min-w-0">
                <p className="font-display text-sm font-bold text-blue-900">Roteiro criado e salvo!</p>
                <p className="truncate text-sm text-blue-900/80">{saved.title}</p>
                <p className="text-xs text-blue-900/60">{saved.folderName ? `Pasta: ${saved.folderName}` : "Sem pasta"}</p>
              </div>
            </div>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => onOpenStage(saved.text)}
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-yellow-500 font-display text-sm font-semibold text-blue-900 shadow-sm transition-all hover:bg-yellow-600 active:scale-[0.98]"
              >
                <Play className="h-4 w-4" /> Abrir no teleprompter
              </button>
              <button
                type="button"
                onClick={onOpenEditor}
                className="flex h-11 items-center justify-center gap-2 rounded-full border-2 border-blue-900 bg-white font-display text-sm font-semibold text-blue-900 transition-all hover:bg-blue-050 active:scale-[0.98]"
              >
                <PenLine className="h-4 w-4" /> Ver e editar no editor
              </button>
              <button
                type="button"
                onClick={() => setSaved(null)}
                className="flex h-10 items-center justify-center gap-2 rounded-full text-sm font-bold text-gray-600 transition-colors hover:bg-white"
              >
                <RotateCcw className="h-4 w-4" /> Criar outro roteiro
              </button>
            </div>
          </div>
        ) : (
          <>
            {isGenerate ? (
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
                    rows={5}
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
                  {!speech.supported && <p className="mt-1 text-[11px] text-gray-400">Ditado por voz disponível no Chrome e no Edge.</p>}
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-bold text-gray-700">Para quê?</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { key: "organico", label: "Conteúdo orgânico", hint: "reels, stories, feed", icon: Leaf },
                      { key: "anuncio", label: "Anúncio (leads)", hint: "segue o que converte", icon: Megaphone },
                    ] as const).map((p) => {
                      const Icon = p.icon;
                      const active = purpose === p.key;
                      return (
                        <button
                          key={p.key}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setPurpose(p.key)}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition-all active:scale-95",
                            active ? "border-blue-900 bg-blue-900 text-white shadow-md" : "border-gray-200 text-gray-700 hover:bg-gray-050"
                          )}
                        >
                          <Icon className={cn("h-4 w-4 shrink-0", active && "text-yellow-400")} />
                          <span className="min-w-0 leading-tight">
                            <span className="block text-xs font-bold">{p.label}</span>
                            <span className={cn("block truncate text-[10px]", active ? "text-blue-100" : "text-gray-400")}>{p.hint}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
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
              <p className="rounded-xl bg-blue-050 px-3.5 py-2.5 text-xs text-blue-800">
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
                placeholder={isGenerate ? "Ex: tom mais bem-humorado, falar com franqueados" : "Ex: deixar mais curto e direto"}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-blue-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-900 focus:shadow-[var(--shadow-focus)]"
                style={{ fontSize: 16 }}
              />
            </div>

            <button
              type="button"
              onClick={() => run(mode)}
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-yellow-500 font-display text-sm font-semibold text-blue-900 shadow-sm transition-all hover:bg-yellow-600 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isGenerate ? <Wand2 className="h-4 w-4" /> : <FileSearch className="h-4 w-4" />}
              {loading ? "Helpinho está escrevendo…" : isGenerate ? "Gerar roteiro" : "Revisar roteiro"}
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
              <div className="ast-fade-up space-y-3">
                <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-yellow-300 bg-yellow-050 px-3.5 py-3 text-sm leading-relaxed text-blue-900">
                  {result.text}
                </div>
                {result.notes && (
                  <div className="rounded-xl bg-blue-050 px-3.5 py-2.5 text-xs text-blue-800">
                    <p className="mb-1 font-bold">O que mudou</p>
                    <p className="whitespace-pre-wrap">{result.notes}</p>
                  </div>
                )}

                {result.mode === "generate" ? (
                  <>
                    {/* Salvar como roteiro novo (ação principal) */}
                    <div className="space-y-2 rounded-2xl border border-gray-200 bg-gray-050/60 p-3">
                      <label htmlFor="ai-title" className="block text-xs font-bold text-gray-700">Título do roteiro</label>
                      <input
                        id="ai-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-blue-900 outline-none focus:border-blue-900 focus:shadow-[var(--shadow-focus)]"
                        style={{ fontSize: 16 }}
                      />
                      <label htmlFor="ai-folder" className="block text-xs font-bold text-gray-700">Pasta</label>
                      <select
                        id="ai-folder"
                        value={folderId ?? ""}
                        onChange={(e) => setFolderId(e.target.value || null)}
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-blue-900 outline-none focus:border-blue-900 focus:shadow-[var(--shadow-focus)]"
                        style={{ fontSize: 16 }}
                      >
                        <option value="">Sem pasta</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={saveAsNew}
                        disabled={saving}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-900 font-display text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 active:scale-[0.98] disabled:opacity-60"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
                        {saving ? "Salvando…" : "Salvar como novo roteiro"}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenStage(result.text)}
                        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border-2 border-blue-900 px-3 text-xs font-bold text-blue-900 transition-all hover:bg-blue-050 active:scale-95"
                      >
                        <Play className="h-3.5 w-3.5" /> Abrir no teleprompter
                      </button>
                      {canInsert ? (
                        <button
                          type="button"
                          onClick={useInOpenScript}
                          title={`Inserir em: ${insertLabel}`}
                          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border-2 border-gray-300 px-3 text-xs font-bold text-gray-700 transition-all hover:bg-gray-050 active:scale-95"
                        >
                          <ArrowRight className="h-3.5 w-3.5" /> Inserir no aberto
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={copy}
                          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border-2 border-gray-300 px-3 text-xs font-bold text-gray-700 transition-all hover:bg-gray-050 active:scale-95"
                        >
                          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copiado" : "Copiar"}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      {canInsert && (
                        <button type="button" onClick={copy} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-gray-600 hover:bg-gray-100">
                          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copiado" : "Copiar"}
                        </button>
                      )}
                      <button type="button" onClick={() => run("generate")} disabled={loading} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-gray-600 hover:bg-gray-100">
                        <RotateCcw className="h-3.5 w-3.5" /> Gerar outra versão
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={useInOpenScript}
                      className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-blue-900 px-4 text-xs font-bold text-white transition-all hover:bg-blue-800 active:scale-95"
                    >
                      <Check className="h-3.5 w-3.5" /> {reviewedSelection ? "Substituir trecho" : "Substituir roteiro"}
                    </button>
                    <button
                      type="button"
                      onClick={copy}
                      className="inline-flex h-11 items-center gap-1.5 rounded-full border-2 border-blue-900 px-3 text-xs font-bold text-blue-900 transition-all hover:bg-blue-050 active:scale-95"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copiado" : "Copiar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => run("review")}
                      disabled={loading}
                      className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-gray-600 transition-all hover:bg-gray-100 active:scale-95"
                    >
                      Revisar de novo
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {onOpenChat && (
        <div className="border-t border-gray-100 p-2.5">
          <button
            type="button"
            onClick={onOpenChat}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full text-xs font-bold text-blue-800 transition-colors hover:bg-blue-050"
          >
            <MessageSquare className="h-3.5 w-3.5" /> Continuar no chat do Helpinho
          </button>
        </div>
      )}
    </div>
  );
}
