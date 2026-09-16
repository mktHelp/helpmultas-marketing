"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Play, Pause, RotateCcw, Plus, Save, Trash2,
  Minus, ChevronsLeftRight, ChevronsRightLeft, Maximize2, Minimize2, X, FileText,
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
const MAX_SPEED = 10;

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

  const tickRef = useRef<() => void>(() => {});
  const tick = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop += speedRef.current * 0.6;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
        stop();
        return;
      }
    }
    rafRef.current = requestAnimationFrame(() => tickRef.current());
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
    rafRef.current = requestAnimationFrame(() => tickRef.current());
  }

  function handlePause() {
    stop();
  }

  function handleRestart() {
    stop();
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }

  useEffect(() => stop, [stop]);

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
  }

  useEffect(() => {
    function onFsChange() {
      if (!document.fullscreenElement) {
        setFullscreen(false);
        stop();
      }
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [stop]);

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
            <div className="flex items-end gap-3">
              <div className="flex-1">
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
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
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
          <Card className="flex flex-wrap items-center gap-4 p-4">
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

            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" onClick={handleRestart} className="gap-1.5">
                <RotateCcw className="h-4 w-4" /> Reiniciar
              </Button>
              {playing ? (
                <Button onClick={handlePause} className="gap-1.5">
                  <Pause className="h-4 w-4" /> Pausar
                </Button>
              ) : (
                <Button onClick={handlePlay} className="gap-1.5">
                  <Play className="h-4 w-4" /> Iniciar
                </Button>
              )}
              <Button
                variant="secondary"
                size="icon"
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
      >
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto overscroll-none px-10 py-24 md:px-24"
          style={{ scrollBehavior: "auto" }}
        >
          <p
            className="mx-auto max-w-4xl whitespace-pre-wrap font-display font-bold leading-relaxed text-white"
            style={{
              fontSize: `${fontSize}px`,
              transform: mirrored ? "scaleX(-1)" : undefined,
            }}
          >
            {content}
          </p>
          <div className="h-[60vh]" />
        </div>

        {/* Barra de controles flutuante */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-6">
          <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center gap-1.5">
              <Button size="icon" variant="secondary" onClick={() => setFontSize((f) => Math.max(MIN_FONT, f - 4))}>
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center text-sm font-bold text-white">{fontSize}</span>
              <Button size="icon" variant="secondary" onClick={() => setFontSize((f) => Math.min(MAX_FONT, f + 4))}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1.5">
              <Button size="icon" variant="secondary" onClick={() => setSpeed((v) => Math.max(MIN_SPEED, v - 1))}>
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center text-sm font-bold text-white">{speed}</span>
              <Button size="icon" variant="secondary" onClick={() => setSpeed((v) => Math.min(MAX_SPEED, v + 1))}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Button variant="secondary" size="icon" onClick={handleRestart} title="Reiniciar">
              <RotateCcw className="h-4 w-4" />
            </Button>

            {playing ? (
              <Button size="icon" onClick={handlePause} title="Pausar">
                <Pause className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" onClick={handlePlay} title="Iniciar">
                <Play className="h-4 w-4" />
              </Button>
            )}

            <Button variant="secondary" size="icon" onClick={() => setMirrored((m) => !m)} title="Espelhar">
              {mirrored ? <ChevronsRightLeft className="h-4 w-4" /> : <ChevronsLeftRight className="h-4 w-4" />}
            </Button>

            <Button variant="secondary" size="icon" onClick={exitFullscreen} title="Fechar">
              <X className="h-4 w-4" />
            </Button>
          </div>
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
