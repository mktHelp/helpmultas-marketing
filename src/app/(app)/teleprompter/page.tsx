"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Play, Pause, RotateCcw, Plus, Save, Trash2,
  Minus, ChevronsLeftRight, ChevronsRightLeft, Maximize2, Minimize2, X, FileText,
  Camera, Circle, Square, Download, RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
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

  return (
    <div>
      <PageHeader
        title="Teleprompter"
        description="Escreva ou selecione um roteiro do banco, ajuste fonte e velocidade e rode em tela cheia."
        action={
          <Button onClick={handleNew} variant="secondary" className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo roteiro
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        {/* Banco de scripts */}
        <Card className="p-4">
          <p className="mb-3 font-display text-sm font-bold text-blue-900">Banco de roteiros</p>
          {loading ? (
            <p className="text-sm text-gray-500">Carregando...</p>
          ) : scripts.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nenhum roteiro salvo"
              description="Crie um roteiro e salve para reutilizar depois."
            />
          ) : (
            <div className="space-y-1.5">
              {scripts.map((s) => (
                <div
                  key={s.id}
                  onClick={() => selectScript(s)}
                  className={cn(
                    "group flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 transition-colors",
                    selectedId === s.id ? "bg-yellow-100" : "hover:bg-gray-050"
                  )}
                >
                  <FileText className="h-4 w-4 shrink-0 text-blue-900" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-blue-900">{s.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(s.id);
                    }}
                    className="shrink-0 rounded-full p-1 text-gray-400 opacity-0 hover:bg-white hover:text-[color:var(--color-danger)] group-hover:opacity-100"
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Editor + palco */}
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 min-w-0">
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
              <Button onClick={handleSave} disabled={saving} className="gap-1.5 w-full sm:w-auto">
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
                className="resize-y touch-manipulation select-text"
                style={{ fontSize: 16, touchAction: "manipulation" }}
              />
            </div>
          </Card>

          {/* Controles */}
          <Card className="flex flex-wrap items-center gap-3 p-4 sm:gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">Fonte</span>
              <Button size="icon" variant="secondary" onClick={() => setFontSize((f) => Math.max(MIN_FONT, f - 4))}>
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-9 text-center text-sm font-bold text-blue-900">{fontSize}</span>
              <Button size="icon" variant="secondary" onClick={() => setFontSize((f) => Math.min(MAX_FONT, f + 4))}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">Velocidade</span>
              <Button size="icon" variant="secondary" onClick={() => setSpeed((v) => Math.max(MIN_SPEED, v - 1))}>
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-9 text-center text-sm font-bold text-blue-900">{speed}</span>
              <Button size="icon" variant="secondary" onClick={() => setSpeed((v) => Math.min(MAX_SPEED, v + 1))}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Button
              variant="secondary"
              className="gap-1.5"
              onClick={() => setMirrored((m) => !m)}
              title="Espelhar texto (para vidro de teleprompter físico)"
            >
              {mirrored ? <ChevronsRightLeft className="h-4 w-4" /> : <ChevronsLeftRight className="h-4 w-4" />}
              {mirrored ? "Espelhado" : "Normal"}
            </Button>

            <Button
              variant="secondary"
              className={cn("gap-1.5", selfieMode && "bg-yellow-100 text-blue-900")}
              onClick={handleToggleSelfie}
              title="Gravar em modo selfie com teleprompter na tela"
            >
              <Camera className="h-4 w-4" />
              {selfieMode ? "Sair do modo selfie" : "Gravar selfie"}
            </Button>

            <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
              <Button variant="secondary" onClick={handleRestart} className="flex-1 gap-1.5 sm:flex-none">
                <RotateCcw className="h-4 w-4" /> Reiniciar
              </Button>
              {playing ? (
                <Button onClick={handlePause} className="flex-1 gap-1.5 sm:flex-none">
                  <Pause className="h-4 w-4" /> Pausar
                </Button>
              ) : (
                <Button onClick={handlePlay} className="flex-1 gap-1.5 sm:flex-none">
                  <Play className="h-4 w-4" /> Iniciar
                </Button>
              )}
              <Button
                variant="secondary"
                size="icon"
                className="shrink-0"
                onClick={() => (fullscreen ? exitFullscreen() : enterFullscreen())}
                title={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
              >
                {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
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
