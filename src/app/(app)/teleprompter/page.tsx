"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Play, Pause, RotateCcw, Plus, Save, Trash2,
  Minus, ChevronsLeftRight, ChevronsRightLeft, Maximize2, Minimize2, X, FileText,
  Camera, Circle, Square, Download, RefreshCw,
  MonitorPlay, Search, Timer, Type, Gauge,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  createTeleprompterScript, deleteTeleprompterScript,
  listTeleprompterScripts, updateTeleprompterScript,
} from "@/lib/services/teleprompterScripts";
import { cn } from "@/lib/utils";
import type { TeleprompterScript } from "@/types/database";

const MIN_FONT = 24;
const MAX_FONT = 96;
const MIN_SPEED = 1;
const MAX_SPEED = 20;
const PX_PER_SEC_PER_SPEED = 12;

function agoLabel(iso: string) {
  try {
    return formatDistanceToNow(parseISO(iso), { locale: ptBR, addSuffix: true });
  } catch {
    return "";
  }
}

function StageButton({
  onClick, label, children, primary, large, active,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  primary?: boolean;
  large?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full transition-colors active:scale-95",
        large ? "h-12 w-12" : "h-10 w-10",
        primary
          ? "bg-yellow-500 text-blue-900 hover:bg-yellow-400"
          : active
          ? "bg-yellow-500/90 text-blue-900"
          : "bg-white/10 text-white hover:bg-white/20"
      )}
    >
      {children}
    </button>
  );
}

export default function TeleprompterPage() {
  const supabase = createClient();
  const { profile: me } = useAuth();

  const [scripts, setScripts] = useState<TeleprompterScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [fontSize, setFontSize] = useState(40);
  const [speed, setSpeed] = useState(4);
  const [mirrored, setMirrored] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // ------------------- Gravação selfie -------------------
  const [selfieMode, setSelfieMode] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);

  const load = useCallback(() => {
    listTeleprompterScripts(supabase)
      .then(setScripts)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(() => scripts.find((s) => s.id === selectedId) || null, [scripts, selectedId]);

  function selectScript(script: TeleprompterScript) {
    if (dirty && !confirm("Você tem alterações não salvas. Descartar e trocar de roteiro?")) return;
    setSelectedId(script.id);
    setTitle(script.title);
    setContent(script.content);
    setDirty(false);
  }

  function handleNew() {
    if (dirty && !confirm("Você tem alterações não salvas. Descartar e criar um novo roteiro?")) return;
    setSelectedId(null);
    setTitle("");
    setContent("");
    setDirty(false);
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Dê um título para o roteiro");
      return;
    }
    setSaving(true);
    try {
      if (selected) {
        const saved = await updateTeleprompterScript(supabase, selected.id, { title, content });
        setScripts((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
      } else {
        const saved = await createTeleprompterScript(supabase, me?.id || "", { title, content });
        setScripts((prev) => [saved, ...prev]);
        setSelectedId(saved.id);
      }
      setDirty(false);
      toast.success("Roteiro salvo");
    } catch {
      toast.error("Erro ao salvar roteiro");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTeleprompterScript(supabase, id);
      setScripts((prev) => prev.filter((s) => s.id !== id));
      if (selectedId === id) handleNew();
      toast.success("Roteiro excluído");
    } catch {
      toast.error("Erro ao excluir roteiro");
    } finally {
      setConfirmDeleteId(null);
    }
  }

  // ------------------- Autoscroll -------------------

  const stop = useCallback(() => {
    setPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Accumulates fractional pixels ourselves — el.scrollTop rounds to an
  // integer internally, so writing sub-pixel deltas straight to it makes
  // slow speeds stall (each frame's fraction gets rounded away to 0).
  const scrollAccumRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);

  const tickRef = useRef<(ts: number) => void>(() => {});
  const tick = useCallback((ts: number) => {
    const el = containerRef.current;
    if (el) {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.1);
      lastTsRef.current = ts;

      scrollAccumRef.current += speedRef.current * PX_PER_SEC_PER_SPEED * dt;
      el.scrollTop = scrollAccumRef.current;

      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
        stop();
        return;
      }
    }
    rafRef.current = requestAnimationFrame((next) => tickRef.current(next));
  }, [stop]);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  function handlePlay() {
    if (!content.trim()) {
      toast.error("Escreva ou selecione um roteiro antes de iniciar");
      return;
    }
    setPlaying(true);
    if (!fullscreen) enterFullscreen();
    // Resync with the real scroll position in case the user dragged the
    // text manually while paused, so resuming continues from there instead
    // of jumping back to wherever our own accumulator last left off.
    if (containerRef.current) scrollAccumRef.current = containerRef.current.scrollTop;
    lastTsRef.current = null;
    rafRef.current = requestAnimationFrame((ts) => tickRef.current(ts));
  }

  function handlePause() {
    stop();
    lastTsRef.current = null;
  }

  function handleRestart() {
    stop();
    lastTsRef.current = null;
    scrollAccumRef.current = 0;
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }

  useEffect(() => stop, [stop]);

  // ------------------- Gravação selfie -------------------

  const stopCameraStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
  }, []);

  const clearRecordTimer = useCallback(() => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }, []);

  const discardRecording = useCallback(() => {
    setRecordedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setRecordSeconds(0);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    setRecording(false);
    clearRecordTimer();
  }, [clearRecordTimer]);

  const exitSelfieMode = useCallback(() => {
    stopRecording();
    stopCameraStream();
    discardRecording();
    setCameraError(null);
    setSelfieMode(false);
  }, [stopRecording, stopCameraStream, discardRecording]);

  async function startCamera() {
    setCameraError(null);
    setCameraLoading(true);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Este navegador não tem acesso à câmera aqui (é preciso HTTPS).");
      setCameraLoading(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraError("Não foi possível acessar a câmera/microfone. Verifique as permissões do navegador.");
    } finally {
      setCameraLoading(false);
    }
  }

  async function handleToggleSelfie() {
    if (selfieMode) {
      exitSelfieMode();
      return;
    }
    setSelfieMode(true);
    if (!fullscreen) enterFullscreen();
    await startCamera();
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) {
      toast.error("Câmera ainda não está pronta. Aguarde ou verifique as permissões.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      toast.error("Este navegador não suporta gravação de vídeo.");
      return;
    }
    discardRecording();
    chunksRef.current = [];
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    const mimeType = candidates.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(t));
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      setRecordedUrl(URL.createObjectURL(blob));
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setRecording(true);
    setRecordSeconds(0);
    recordTimerRef.current = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
  }

  function handleRecordAgain() {
    discardRecording();
  }

  async function handleSaveRecording() {
    if (!recordedUrl) return;
    try {
      const res = await fetch(recordedUrl);
      const blob = await res.blob();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const base = (title || "gravacao-selfie").trim().replace(/\s+/g, "-").toLowerCase();
      const filename = `${base}-${Date.now()}.${ext}`;
      const file = new File([blob], filename, { type: blob.type });

      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename });
          toast.success("Vídeo enviado");
          return;
        } catch {
          // usuário cancelou o compartilhamento — cai no download abaixo
        }
      }

      const a = document.createElement("a");
      a.href = recordedUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Vídeo salvo");
    } catch {
      toast.error("Erro ao salvar o vídeo");
    }
  }

  function formatDuration(total: number) {
    const m = Math.floor(total / 60).toString().padStart(2, "0");
    const s = (total % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  useEffect(() => {
    return () => {
      stopCameraStream();
      clearRecordTimer();
      setRecordedUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A pré-visualização da câmera é desmontada enquanto o vídeo gravado é
  // exibido; ao voltar para ela (novo elemento <video>), reconecta o
  // MediaStream que já está ativo em vez de pedir a câmera de novo.
  useEffect(() => {
    if (selfieMode && !recordedUrl && cameraVideoRef.current && streamRef.current) {
      cameraVideoRef.current.srcObject = streamRef.current;
      cameraVideoRef.current.play().catch(() => {});
    }
  }, [selfieMode, recordedUrl]);

  // ------------------- Fullscreen -------------------

  function enterFullscreen() {
    const el = stageRef.current;
    if (el && el.requestFullscreen) el.requestFullscreen().catch(() => {});
    setFullscreen(true);
  }

  function exitFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setFullscreen(false);
    stop();
    if (selfieMode) exitSelfieMode();
  }

  useEffect(() => {
    function onFsChange() {
      if (!document.fullscreenElement) {
        setFullscreen(false);
        stop();
        if (selfieMode) exitSelfieMode();
      }
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop, selfieMode]);

  const [query, setQuery] = useState("");
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const readSeconds = Math.round((wordCount / 150) * 60);
  const readLabel = readSeconds < 60 ? `${readSeconds}s` : `${Math.floor(readSeconds / 60)}min ${String(readSeconds % 60).padStart(2, "0")}s`;
  const filteredScripts = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return scripts;
    return scripts.filter((sc) => sc.title.toLowerCase().includes(q) || sc.content.toLowerCase().includes(q));
  })();

  return (
    <div>
      {/* Banner */}
      <div className="ast-fade-up relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 p-5 text-white sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-12 h-52 w-52 rounded-full bg-yellow-500/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-sky-400/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="ast-float flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-yellow-500 text-blue-900 shadow-lg">
            <MonitorPlay className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1 basis-64">
            <h1 className="font-display text-2xl font-bold">Teleprompter</h1>
            <p className="mt-0.5 text-sm text-blue-100">
              Escreva ou escolha um roteiro, ajuste fonte e velocidade e rode em tela cheia, ou grave em modo selfie.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Button onClick={handleNew} variant="secondary" className="gap-1.5 border-white/40 bg-white/10 text-white hover:bg-white/20">
              <Plus className="h-4 w-4" /> Novo roteiro
            </Button>
            <Button onClick={handlePlay} disabled={!content.trim()} className="gap-1.5">
              <Play className="h-4 w-4" /> Abrir teleprompter
            </Button>
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-white/10 px-3 py-1">{scripts.length} {scripts.length === 1 ? "roteiro salvo" : "roteiros salvos"}</span>
          <span className="rounded-full bg-white/10 px-3 py-1">{wordCount} palavras no editor</span>
          {wordCount > 0 && <span className="rounded-full bg-yellow-500/90 px-3 py-1 text-blue-900">leitura ~ {readLabel}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        {/* Banco de scripts */}
        <Card className="ast-fade-up flex max-h-[calc(100dvh-200px)] min-h-[320px] flex-col p-0" style={{ animationDelay: "80ms" }}>
          <div className="space-y-3 border-b border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <p className="font-display text-sm font-bold text-blue-900">Banco de roteiros</p>
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-bold text-blue-900">{filteredScripts.length}</span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar roteiro..."
                aria-label="Buscar roteiro"
                className="h-10 w-full rounded-full border border-gray-200 bg-gray-050 pl-9 pr-3 text-sm text-blue-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-900 focus:bg-white focus:shadow-[var(--shadow-focus)]"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {loading ? (
              [0, 1, 2].map((i) => <div key={i} className="ast-skeleton h-20 rounded-2xl" style={{ animationDelay: `${i * 100}ms` }} />)
            ) : scripts.length === 0 ? (
              <EmptyState icon={FileText} title="Nenhum roteiro salvo" description="Crie um roteiro e salve para reutilizar depois." />
            ) : filteredScripts.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">Nenhum roteiro encontrado.</p>
            ) : (
              filteredScripts.map((s, i) => {
                const active = selectedId === s.id;
                const words = s.content.trim() ? s.content.trim().split(/\s+/).length : 0;
                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectScript(s)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectScript(s);
                      }
                    }}
                    style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                    className={cn(
                      "kb-card-in group relative cursor-pointer overflow-hidden rounded-2xl border px-3.5 py-3 outline-none transition-all duration-200",
                      "focus-visible:ring-2 focus-visible:ring-blue-900",
                      active ? "border-yellow-400 bg-yellow-050 shadow-[var(--shadow-sm)]" : "border-gray-200 bg-white hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-[var(--shadow-md)]"
                    )}
                  >
                    {active && <span className="absolute inset-y-0 left-0 w-1 bg-yellow-500" aria-hidden />}
                    <div className="flex items-start gap-2">
                      <FileText className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-yellow-600" : "text-blue-700")} />
                      <p className="min-w-0 flex-1 truncate text-sm font-bold text-blue-900">{s.title}</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(s.id);
                        }}
                        className="shrink-0 rounded-full p-1 text-gray-400 opacity-100 transition-opacity hover:bg-white hover:text-[color:var(--color-danger)] sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                        title="Excluir"
                        aria-label={`Excluir roteiro ${s.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {s.content && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{s.content}</p>}
                    <p className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-gray-400">
                      <span>{words} palavras</span>
                      <span aria-hidden>·</span>
                      <span>{agoLabel(s.updated_at)}</span>
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Editor + palco */}
        <div className="min-w-0 space-y-4">
          <Card className="ast-fade-up space-y-3 p-4" style={{ animationDelay: "120ms" }}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Label>Título do roteiro</Label>
                <Input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="Ex: Reels sobre multas de trânsito"
                  className="text-base"
                  style={{ fontSize: 16 }}
                />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full gap-1.5 sm:w-auto">
                <Save className="h-4 w-4" /> {saving ? "Salvando..." : selected ? "Atualizar" : "Salvar"}
              </Button>
            </div>
            <div>
              <Label>Texto do roteiro</Label>
              <Textarea
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setDirty(true);
                }}
                placeholder="Escreva aqui o texto que vai rolar no teleprompter..."
                rows={10}
                className="touch-manipulation select-text resize-y"
                style={{ fontSize: 16, touchAction: "manipulation" }}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-gray-500">
                <span className="rounded-full bg-gray-100 px-2.5 py-1">{wordCount} palavras</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1">{content.length} caracteres</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
                  <Timer className="h-3 w-3" /> leitura ~ {readLabel}
                </span>
                {dirty && (
                  <span className="ast-pop ml-auto inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-2.5 py-1 text-blue-900">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-600" /> alterações não salvas
                  </span>
                )}
              </div>
            </div>
          </Card>

          {/* Ajustes + prévia */}
          <Card className="ast-fade-up grid gap-4 p-4 md:grid-cols-[1fr_1fr]" style={{ animationDelay: "160ms" }}>
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
                    <Type className="h-3.5 w-3.5" /> Fonte
                  </span>
                  <span className="rounded-full bg-blue-050 px-2 py-0.5 text-xs font-bold text-blue-900">{fontSize}px</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="secondary" onClick={() => setFontSize((f) => Math.max(MIN_FONT, f - 4))} aria-label="Diminuir fonte">
                    <Minus className="h-4 w-4" />
                  </Button>
                  <input
                    type="range"
                    min={MIN_FONT}
                    max={MAX_FONT}
                    step={4}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    aria-label="Tamanho da fonte"
                    className="h-2 flex-1 cursor-pointer accent-[var(--yellow-500)]"
                  />
                  <Button size="icon" variant="secondary" onClick={() => setFontSize((f) => Math.min(MAX_FONT, f + 4))} aria-label="Aumentar fonte">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
                    <Gauge className="h-3.5 w-3.5" /> Velocidade
                  </span>
                  <span className="rounded-full bg-blue-050 px-2 py-0.5 text-xs font-bold text-blue-900">{speed}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="secondary" onClick={() => setSpeed((v) => Math.max(MIN_SPEED, v - 1))} aria-label="Diminuir velocidade">
                    <Minus className="h-4 w-4" />
                  </Button>
                  <input
                    type="range"
                    min={MIN_SPEED}
                    max={MAX_SPEED}
                    step={1}
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    aria-label="Velocidade de rolagem"
                    className="h-2 flex-1 cursor-pointer accent-[var(--yellow-500)]"
                  />
                  <Button size="icon" variant="secondary" onClick={() => setSpeed((v) => Math.min(MAX_SPEED, v + 1))} aria-label="Aumentar velocidade">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMirrored((m) => !m)}
                  aria-pressed={mirrored}
                  title="Espelhar texto (para vidro de teleprompter físico)"
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-full border-2 px-4 font-display text-sm font-semibold transition-all active:scale-95",
                    mirrored ? "border-blue-900 bg-blue-900 text-white" : "border-blue-900 bg-white text-blue-900 hover:bg-blue-050"
                  )}
                >
                  {mirrored ? <ChevronsRightLeft className="h-4 w-4" /> : <ChevronsLeftRight className="h-4 w-4" />}
                  {mirrored ? "Espelhado" : "Normal"}
                </button>
                <button
                  type="button"
                  onClick={handleToggleSelfie}
                  aria-pressed={selfieMode}
                  title="Gravar em modo selfie com teleprompter na tela"
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-full border-2 px-4 font-display text-sm font-semibold transition-all active:scale-95",
                    selfieMode ? "border-yellow-500 bg-yellow-500 text-blue-900" : "border-blue-900 bg-white text-blue-900 hover:bg-blue-050"
                  )}
                >
                  <Camera className="h-4 w-4" />
                  {selfieMode ? "Sair do modo selfie" : "Gravar selfie"}
                </button>
              </div>
            </div>

            {/* Prévia ao vivo */}
            <div className="flex min-h-[200px] flex-col overflow-hidden rounded-2xl bg-black">
              <div className="flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white/50">
                <span>Prévia</span>
                <span>{fontSize}px · vel. {speed}</span>
              </div>
              <div className="relative min-h-0 flex-1 overflow-hidden px-4">
                <p
                  className="whitespace-pre-wrap font-display font-bold leading-relaxed text-white transition-all duration-300"
                  style={{
                    fontSize: `${Math.max(12, Math.round(fontSize * 0.42))}px`,
                    transform: mirrored ? "scaleX(-1)" : undefined,
                  }}
                >
                  {content.trim() ? content.slice(0, 220) : "Seu texto aparece aqui…"}
                </p>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black to-transparent" aria-hidden />
              </div>
            </div>
          </Card>

          {/* Ações */}
          <Card className="ast-fade-up flex flex-wrap items-center gap-3 p-4" style={{ animationDelay: "200ms" }}>
            <Button onClick={handlePlay} disabled={!content.trim()} className="gap-1.5">
              <Play className="h-4 w-4" /> Abrir teleprompter
            </Button>
            {playing && (
              <Button onClick={handlePause} variant="secondary" className="gap-1.5">
                <Pause className="h-4 w-4" /> Pausar
              </Button>
            )}
            <Button variant="secondary" onClick={handleRestart} className="gap-1.5">
              <RotateCcw className="h-4 w-4" /> Reiniciar
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="ml-auto shrink-0"
              onClick={() => (fullscreen ? exitFullscreen() : enterFullscreen())}
              title={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
              aria-label={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </Card>
        </div>
      </div>

      {/* Palco do teleprompter (fica montado sempre para permitir fullscreen nativo) */}
      <div
        ref={stageRef}
        className={cn(
          "fixed inset-0 z-[100] flex-col bg-black",
          fullscreen ? "flex" : "hidden"
        )}
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        {/* Câmera selfie ao vivo (fica atrás do texto, só é capturada pela gravação) */}
        {selfieMode && !recordedUrl && (
          <video
            ref={cameraVideoRef}
            muted
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        )}

        {/* Revisão do vídeo gravado */}
        {selfieMode && recordedUrl && (
          <video
            src={recordedUrl}
            controls
            playsInline
            className="absolute inset-0 h-full w-full bg-black object-contain"
          />
        )}

        {selfieMode && cameraError && (
          <div className="absolute inset-x-4 top-1/2 z-10 -translate-y-1/2 rounded-2xl bg-black/80 p-4 text-center text-sm text-white">
            {cameraError}
          </div>
        )}

        {!(selfieMode && recordedUrl) && (
          <div
            ref={containerRef}
            className="relative z-10 flex-1 overflow-y-auto overscroll-none px-6 py-20 sm:px-10 sm:py-24 md:px-24"
            style={{ scrollBehavior: "auto" }}
          >
            <p
              className="mx-auto max-w-4xl whitespace-pre-wrap font-display font-bold leading-relaxed text-white"
              style={{
                fontSize: `${fontSize}px`,
                transform: mirrored ? "scaleX(-1)" : undefined,
                textShadow: selfieMode ? "0 2px 10px rgba(0,0,0,0.9)" : undefined,
              }}
            >
              {content}
            </p>
            <div className="h-[60vh]" />
          </div>
        )}

        {selfieMode && recording && (
          <div className="pointer-events-none absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-sm font-bold text-white" style={{ marginTop: "env(safe-area-inset-top)" }}>
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            REC {formatDuration(recordSeconds)}
          </div>
        )}

        {/* Barra de controles flutuante */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-4 sm:pb-6">
          {!selfieMode && (
            <div className="pointer-events-auto flex w-full max-w-sm flex-col gap-2.5 rounded-2xl bg-black/80 px-3 py-3 backdrop-blur-md sm:w-auto sm:max-w-none sm:flex-row sm:items-center sm:gap-4 sm:px-4">
              {/* Fonte + Velocidade */}
              <div className="flex items-center justify-between gap-3 sm:justify-start sm:gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">Fonte</span>
                  <StageButton onClick={() => setFontSize((f) => Math.max(MIN_FONT, f - 4))} label="Diminuir fonte">
                    <Minus className="h-4 w-4" />
                  </StageButton>
                  <span className="w-6 text-center text-sm font-bold text-white">{fontSize}</span>
                  <StageButton onClick={() => setFontSize((f) => Math.min(MAX_FONT, f + 4))} label="Aumentar fonte">
                    <Plus className="h-4 w-4" />
                  </StageButton>
                </div>

                <div className="h-6 w-px shrink-0 bg-white/15" />

                <div className="flex items-center gap-1.5">
                  <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">Vel.</span>
                  <StageButton onClick={() => setSpeed((v) => Math.max(MIN_SPEED, v - 1))} label="Diminuir velocidade">
                    <Minus className="h-4 w-4" />
                  </StageButton>
                  <span className="w-6 text-center text-sm font-bold text-white">{speed}</span>
                  <StageButton onClick={() => setSpeed((v) => Math.min(MAX_SPEED, v + 1))} label="Aumentar velocidade">
                    <Plus className="h-4 w-4" />
                  </StageButton>
                </div>
              </div>

              <div className="hidden h-6 w-px shrink-0 bg-white/15 sm:block" />

              {/* Ações */}
              <div className="flex items-center justify-center gap-2.5">
                <StageButton onClick={handleRestart} label="Reiniciar">
                  <RotateCcw className="h-4 w-4" />
                </StageButton>

                {playing ? (
                  <StageButton onClick={handlePause} label="Pausar" primary large>
                    <Pause className="h-5 w-5" />
                  </StageButton>
                ) : (
                  <StageButton onClick={handlePlay} label="Iniciar" primary large>
                    <Play className="h-5 w-5" />
                  </StageButton>
                )}

                <StageButton onClick={() => setMirrored((m) => !m)} label="Espelhar texto" active={mirrored}>
                  {mirrored ? <ChevronsRightLeft className="h-4 w-4" /> : <ChevronsLeftRight className="h-4 w-4" />}
                </StageButton>

                <StageButton onClick={exitFullscreen} label="Fechar tela cheia">
                  <X className="h-4 w-4" />
                </StageButton>
              </div>
            </div>
          )}

          {selfieMode && !recordedUrl && (
            <div className="pointer-events-auto flex w-full max-w-sm flex-col gap-2.5 rounded-2xl bg-black/80 px-3 py-3 backdrop-blur-md sm:w-auto sm:max-w-none sm:flex-row sm:items-center sm:gap-4 sm:px-4">
              <div className="flex items-center gap-1.5">
                <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">Fonte</span>
                <StageButton onClick={() => setFontSize((f) => Math.max(MIN_FONT, f - 4))} label="Diminuir fonte">
                  <Minus className="h-4 w-4" />
                </StageButton>
                <span className="w-6 text-center text-sm font-bold text-white">{fontSize}</span>
                <StageButton onClick={() => setFontSize((f) => Math.min(MAX_FONT, f + 4))} label="Aumentar fonte">
                  <Plus className="h-4 w-4" />
                </StageButton>
              </div>

              <div className="h-6 w-px shrink-0 bg-white/15" />

              <div className="flex items-center gap-1.5">
                <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">Vel.</span>
                <StageButton onClick={() => setSpeed((v) => Math.max(MIN_SPEED, v - 1))} label="Diminuir velocidade">
                  <Minus className="h-4 w-4" />
                </StageButton>
                <span className="w-6 text-center text-sm font-bold text-white">{speed}</span>
                <StageButton onClick={() => setSpeed((v) => Math.min(MAX_SPEED, v + 1))} label="Aumentar velocidade">
                  <Plus className="h-4 w-4" />
                </StageButton>
              </div>

              <div className="hidden h-6 w-px shrink-0 bg-white/15 sm:block" />

              <div className="flex items-center justify-center gap-2.5">
                <StageButton onClick={handleRestart} label="Reiniciar texto">
                  <RotateCcw className="h-4 w-4" />
                </StageButton>

                {playing ? (
                  <StageButton onClick={handlePause} label="Pausar rolagem">
                    <Pause className="h-4 w-4" />
                  </StageButton>
                ) : (
                  <StageButton onClick={handlePlay} label="Iniciar rolagem">
                    <Play className="h-4 w-4" />
                  </StageButton>
                )}

                {cameraLoading ? (
                  <StageButton onClick={() => {}} label="Carregando câmera" primary large>
                    <Camera className="h-5 w-5 animate-pulse" />
                  </StageButton>
                ) : recording ? (
                  <StageButton onClick={stopRecording} label="Parar gravação" primary large active>
                    <Square className="h-5 w-5" />
                  </StageButton>
                ) : (
                  <StageButton onClick={startRecording} label="Iniciar gravação" primary large>
                    <Circle className="h-5 w-5" />
                  </StageButton>
                )}

                <StageButton onClick={exitSelfieMode} label="Sair do modo selfie">
                  <X className="h-4 w-4" />
                </StageButton>
              </div>
            </div>
          )}

          {selfieMode && recordedUrl && (
            <div className="pointer-events-auto flex w-full max-w-sm flex-col gap-2.5 rounded-2xl bg-black/80 px-3 py-3 backdrop-blur-md sm:w-auto sm:max-w-none sm:flex-row sm:items-center sm:gap-4 sm:px-4">
              <div className="flex items-center justify-center gap-2.5">
                <StageButton onClick={handleRecordAgain} label="Gravar novamente">
                  <RefreshCw className="h-4 w-4" />
                </StageButton>

                <StageButton onClick={handleSaveRecording} label="Salvar no celular" primary large>
                  <Download className="h-5 w-5" />
                </StageButton>

                <StageButton onClick={exitSelfieMode} label="Sair do modo selfie">
                  <X className="h-4 w-4" />
                </StageButton>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        title="Excluir roteiro"
        description="Tem certeza que deseja excluir este roteiro do banco?"
        confirmLabel="Excluir"
        danger
      />
    </div>
  );
}
