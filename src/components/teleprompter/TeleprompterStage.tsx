"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRightLeft, Camera, ChevronsLeftRight, ChevronsRightLeft, Circle, Download, Minus, Pause, Play, Plus,
  RefreshCw, RotateCcw, Square, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const MIN_FONT = 24;
export const MAX_FONT = 96;
export const MIN_SPEED = 1;
export const MAX_SPEED = 20;
const PX_PER_SEC_PER_SPEED = 12;
const COUNTDOWN_SECONDS = 10;

export interface StageHandle {
  /** Abre o teleprompter em tela cheia, pausado. Chamar direto de um clique (exigência da tela cheia). */
  open: (opts: { text: string; selfie?: boolean }) => void;
}

function RailButton({
  onClick, label, children, primary, size = "md", active, danger,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  primary?: boolean;
  size?: "md" | "lg" | "xl";
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full transition-all active:scale-90",
        size === "md" && "h-11 w-11",
        size === "lg" && "h-16 w-16",
        size === "xl" && "h-20 w-20 shadow-lg shadow-yellow-500/30",
        danger
          ? "bg-red-600 text-white hover:bg-red-500"
          : primary
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

function Stepper({
  label, value, onMinus, onPlus, minusLabel, plusLabel,
}: {
  label: string;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
  minusLabel: string;
  plusLabel: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/5 px-1.5 py-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">{label}</span>
      <RailButton onClick={onPlus} label={plusLabel}>
        <Plus className="h-4 w-4" />
      </RailButton>
      <span className="w-full text-center text-sm font-bold text-white tabular-nums">{value}</span>
      <RailButton onClick={onMinus} label={minusLabel}>
        <Minus className="h-4 w-4" />
      </RailButton>
    </div>
  );
}

const Divider = () => <span className="h-px w-8 shrink-0 bg-white/15" aria-hidden />;

function formatDuration(total: number) {
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export const TeleprompterStage = forwardRef<
  StageHandle,
  {
    fontSize: number;
    onFontSize: (updater: (f: number) => number) => void;
    speed: number;
    onSpeed: (updater: (v: number) => number) => void;
    mirrored: boolean;
    onMirrored: (updater: (m: boolean) => boolean) => void;
    /** usado no nome do arquivo da gravação */
    title: string;
    /** chamado depois de salvar/compartilhar o vídeo gravado */
    onRecordingSaved?: () => void;
  }
>(function TeleprompterStage({ fontSize, onFontSize, speed, onSpeed, mirrored, onMirrored, title, onRecordingSaved }, ref) {
  const [text, setText] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [railLeft, setRailLeft] = useState(false);

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

  // ------------------- Autoscroll -------------------

  const stop = useCallback(() => {
    setPlaying(false);
    setCountdown(null);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Acumula os pixels fracionários por conta própria — el.scrollTop arredonda
  // para inteiro, então escrever deltas sub-pixel direto nele faz as
  // velocidades baixas travarem (a fração de cada quadro seria descartada).
  const scrollAccumRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);

  const tickRef = useRef<(ts: number) => void>(() => {});
  const tick = useCallback(
    (ts: number) => {
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
    },
    [stop]
  );

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const beginScroll = useCallback(() => {
    setPlaying(true);
    // Ressincroniza com a posição real caso a pessoa tenha arrastado o texto
    // com o dedo/mouse enquanto estava pausado.
    if (containerRef.current) scrollAccumRef.current = containerRef.current.scrollTop;
    lastTsRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame((ts) => tickRef.current(ts));
  }, []);

  const beginScrollRef = useRef(beginScroll);
  useEffect(() => {
    beginScrollRef.current = beginScroll;
  }, [beginScroll]);

  // Contagem regressiva de 10s antes de começar a rolar.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      beginScrollRef.current();
      return;
    }
    const id = window.setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [countdown]);

  function handlePlay() {
    if (playing || countdown !== null) {
      // play/pause: durante a contagem, tocar de novo cancela
      stop();
      lastTsRef.current = null;
      return;
    }
    const el = containerRef.current;
    // Retomar do meio do texto continua na hora; do início, faz a contagem.
    if (el && el.scrollTop > 2) beginScroll();
    else setCountdown(COUNTDOWN_SECONDS);
  }

  function handleRestart() {
    stop();
    lastTsRef.current = null;
    scrollAccumRef.current = 0;
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }

  useEffect(() => stop, [stop]);

  // ------------------- Câmera / gravação -------------------

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
    const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported?.(t));
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
          onRecordingSaved?.();
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
      onRecordingSaved?.();
    } catch {
      toast.error("Erro ao salvar o vídeo");
    }
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
  // exibido; ao voltar para ela (novo <video>), reconecta o MediaStream que
  // já está ativo em vez de pedir a câmera de novo.
  useEffect(() => {
    if (selfieMode && !recordedUrl && cameraVideoRef.current && streamRef.current) {
      cameraVideoRef.current.srcObject = streamRef.current;
      cameraVideoRef.current.play().catch(() => {});
    }
  }, [selfieMode, recordedUrl]);

  // ------------------- Tela cheia -------------------

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

  useImperativeHandle(ref, () => ({
    open: ({ text: nextText, selfie }) => {
      if (!nextText.trim()) {
        toast.error("Escreva ou selecione um trecho antes de abrir o teleprompter");
        return;
      }
      setText(nextText);
      stop();
      scrollAccumRef.current = 0;
      lastTsRef.current = null;
      if (containerRef.current) containerRef.current.scrollTop = 0;
      enterFullscreen();
      if (selfie) {
        setSelfieMode(true);
        void startCamera();
      }
    },
  }));

  // Atalhos no palco: espaço = play/pause, setas = velocidade, +/- = fonte, M = espelhar.
  useEffect(() => {
    if (!fullscreen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "Space") {
        e.preventDefault();
        handlePlay();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        onSpeed((v) => Math.min(MAX_SPEED, v + 1));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        onSpeed((v) => Math.max(MIN_SPEED, v - 1));
      } else if (e.key === "+" || e.key === "=") {
        onFontSize((f) => Math.min(MAX_FONT, f + 4));
      } else if (e.key === "-") {
        onFontSize((f) => Math.max(MIN_FONT, f - 4));
      } else if (e.key.toLowerCase() === "m") {
        onMirrored((m) => !m);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen, playing, countdown]);

  const reviewing = selfieMode && !!recordedUrl;
  const playIcon = playing || countdown !== null ? <Pause className="h-9 w-9" /> : <Play className="ml-1 h-9 w-9" />;

  return (
    <div
      ref={stageRef}
      className={cn("fixed inset-0 z-[100] flex-col bg-black", fullscreen ? "flex" : "hidden")}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* Câmera selfie ao vivo (atrás do texto; só é capturada pela gravação) */}
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
      {reviewing && <video src={recordedUrl!} controls playsInline className="absolute inset-0 h-full w-full bg-black object-contain" />}

      {selfieMode && cameraError && (
        <div className="absolute inset-x-4 top-1/2 z-10 -translate-y-1/2 rounded-2xl bg-black/80 p-4 text-center text-sm text-white">
          {cameraError}
        </div>
      )}

      {!reviewing && (
        <div
          ref={containerRef}
          className={cn(
            "relative z-10 flex-1 overflow-y-auto overscroll-none py-20 sm:py-24",
            railLeft ? "pl-24 pr-6 sm:pl-28 sm:pr-10 md:pl-36 md:pr-24" : "pl-6 pr-24 sm:pl-10 sm:pr-28 md:pl-24 md:pr-36"
          )}
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
            {text}
          </p>
          <div className="h-[60vh]" />
        </div>
      )}

      {/* Contagem regressiva */}
      {countdown !== null && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/55 backdrop-blur-[2px]" role="status" aria-live="assertive">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-white/70">Começando em</p>
          <div className="relative flex h-44 w-44 items-center justify-center sm:h-56 sm:w-56">
            <span className="ast-ring absolute inset-0 rounded-full border-4 border-yellow-500/70" aria-hidden />
            <span
              key={countdown}
              className={cn(
                "ast-pop font-display text-8xl font-extrabold tabular-nums sm:text-9xl",
                countdown <= 3 ? "text-yellow-400" : "text-white"
              )}
            >
              {countdown}
            </span>
          </div>
          <p className="text-xs font-semibold text-white/60">Toque em pausar (ou espaço) para cancelar</p>
        </div>
      )}

      {selfieMode && recording && (
        <div
          className="pointer-events-none absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-sm font-bold text-white"
          style={{ marginTop: "env(safe-area-inset-top)" }}
        >
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          REC {formatDuration(recordSeconds)}
        </div>
      )}

      {/* Painel lateral de controles */}
      <div
        className={cn(
          "absolute top-1/2 z-40 flex max-h-[96dvh] -translate-y-1/2 flex-col items-center gap-2.5 overflow-y-auto rounded-[28px] bg-black/75 p-2.5 backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          railLeft ? "left-2 sm:left-3" : "right-2 sm:right-3"
        )}
        style={{ marginLeft: "env(safe-area-inset-left)", marginRight: "env(safe-area-inset-right)" }}
      >
        <RailButton onClick={selfieMode ? exitSelfieMode : exitFullscreen} label={selfieMode ? "Sair do modo selfie" : "Fechar tela cheia"}>
          <X className="h-5 w-5" />
        </RailButton>

        {reviewing ? (
          <>
            <Divider />
            <RailButton onClick={handleSaveRecording} label="Salvar no celular" primary size="xl">
              <Download className="h-9 w-9" />
            </RailButton>
            <RailButton onClick={discardRecording} label="Gravar novamente" size="lg">
              <RefreshCw className="h-6 w-6" />
            </RailButton>
          </>
        ) : (
          <>
            <Divider />
            <RailButton onClick={() => onMirrored((m) => !m)} label="Inverter texto (espelhar)" size="lg" active={mirrored}>
              {mirrored ? <ChevronsRightLeft className="h-8 w-8" /> : <ChevronsLeftRight className="h-8 w-8" />}
            </RailButton>

            {selfieMode ? (
              <>
                <RailButton onClick={handlePlay} label={playing || countdown !== null ? "Pausar rolagem" : "Iniciar rolagem"} size="lg">
                  {playing || countdown !== null ? <Pause className="h-7 w-7" /> : <Play className="ml-0.5 h-7 w-7" />}
                </RailButton>
                {cameraLoading ? (
                  <RailButton onClick={() => {}} label="Carregando câmera" primary size="xl">
                    <Camera className="h-9 w-9 animate-pulse" />
                  </RailButton>
                ) : recording ? (
                  <RailButton onClick={stopRecording} label="Parar gravação" danger size="xl">
                    <Square className="h-8 w-8" />
                  </RailButton>
                ) : (
                  <RailButton onClick={startRecording} label="Iniciar gravação" primary size="xl">
                    <Circle className="h-9 w-9" />
                  </RailButton>
                )}
              </>
            ) : (
              <RailButton onClick={handlePlay} label={playing || countdown !== null ? "Pausar" : "Iniciar (contagem de 10s)"} primary size="xl">
                {playIcon}
              </RailButton>
            )}

            <RailButton onClick={handleRestart} label="Reiniciar do começo">
              <RotateCcw className="h-5 w-5" />
            </RailButton>

            <Divider />
            <Stepper
              label="Fonte"
              value={fontSize}
              onPlus={() => onFontSize((f) => Math.min(MAX_FONT, f + 4))}
              onMinus={() => onFontSize((f) => Math.max(MIN_FONT, f - 4))}
              plusLabel="Aumentar fonte"
              minusLabel="Diminuir fonte"
            />
            <Stepper
              label="Vel."
              value={speed}
              onPlus={() => onSpeed((v) => Math.min(MAX_SPEED, v + 1))}
              onMinus={() => onSpeed((v) => Math.max(MIN_SPEED, v - 1))}
              plusLabel="Aumentar velocidade"
              minusLabel="Diminuir velocidade"
            />
          </>
        )}

        <Divider />
        <RailButton onClick={() => setRailLeft((v) => !v)} label="Mover painel para o outro lado">
          <ArrowRightLeft className="h-4 w-4" />
        </RailButton>
      </div>
    </div>
  );
});
