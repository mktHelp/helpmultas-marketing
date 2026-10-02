"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Camera, CalendarClock, Check, ChevronsLeftRight, ChevronsRightLeft, FileText, Folder, FolderPlus, Gauge,
  FolderOpen, List, Minus, MonitorPlay, Pencil, PenLine, Play, Plus, Save, Search, Sparkles, Trash2, Type,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ScriptEditor, textToHtml, type ScriptEditorHandle } from "@/components/teleprompter/ScriptEditor";
import { AiPanel } from "@/components/teleprompter/AiPanel";
import { FolderDialog } from "@/components/teleprompter/FolderDialog";
import {
  MAX_FONT, MAX_SPEED, MIN_FONT, MIN_SPEED, TeleprompterStage, type StageHandle,
} from "@/components/teleprompter/TeleprompterStage";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  createTeleprompterFolder, createTeleprompterScript, deleteTeleprompterFolder, deleteTeleprompterScript,
  listTeleprompterFolders, listTeleprompterScripts, setTeleprompterRecorded, updateTeleprompterFolder,
  updateTeleprompterScript,
} from "@/lib/services/teleprompterScripts";
import { cn } from "@/lib/utils";
import type { TeleprompterFolder, TeleprompterScript } from "@/types/database";

type View = "pending" | "recorded";
type Tab = "scripts" | "editor" | "ai" | "stage";
type Layout = "folders" | "list";
type FolderFilter = "all" | "none" | string;

const todayStr = () => format(new Date(), "yyyy-MM-dd");

/** "2026-10-05" -> "05/10" sem passar por Date (evita deslocar o dia pelo fuso). */
function shortDate(isoDate: string) {
  const [, m, d] = isoDate.split("-");
  return `${d}/${m}`;
}

function agoLabel(iso: string) {
  try {
    return formatDistanceToNow(parseISO(iso), { locale: ptBR, addSuffix: true });
  } catch {
    return "";
  }
}

function wordsOf(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Chave lida pela página do Helpinho para abrir uma conversa já com o roteiro no campo. */
const HANDOFF_KEY = "hm-helpinho-handoff";

export default function TeleprompterPage() {
  return (
    <Suspense fallback={null}>
      <TeleprompterContent />
    </Suspense>
  );
}

function TeleprompterContent() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile: me } = useAuth();

  const [scripts, setScripts] = useState<TeleprompterScript[]>([]);
  const [folders, setFolders] = useState<TeleprompterFolder[]>([]);
  const [loading, setLoading] = useState(true);

  // roteiro aberto no editor (selectedId = null -> rascunho novo)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [recordDate, setRecordDate] = useState("");
  const [initialHtml, setInitialHtml] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [previewText, setPreviewText] = useState("");

  const [tab, setTab] = useState<Tab>("scripts");

  // lista
  const [view, setView] = useState<View>("pending");
  const [folderFilter, setFolderFilter] = useState<FolderFilter>("all");
  const [query, setQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [folderDialog, setFolderDialog] = useState<{ mode: "create" | "edit"; forEditor?: boolean } | null>(null);
  const [confirmFolder, setConfirmFolder] = useState<TeleprompterFolder | null>(null);

  // palco
  const [fontSize, setFontSize] = useState(40);
  const [speed, setSpeed] = useState(4);
  const [mirrored, setMirrored] = useState(false);
  const [aiOpen, setAiOpen] = useState(true);
  const [layout, setLayout] = useState<Layout>("folders");

  const editorRef = useRef<ScriptEditorHandle>(null);
  const stageRef = useRef<StageHandle>(null);

  const selected = useMemo(() => scripts.find((s) => s.id === selectedId) ?? null, [scripts, selectedId]);

  useEffect(() => {
    Promise.all([listTeleprompterScripts(supabase), listTeleprompterFolders(supabase)])
      .then(([s, f]) => {
        setScripts(s);
        setFolders(f);
      })
      .catch(() => toast.error("Não foi possível carregar os roteiros"))
      .finally(() => setLoading(false));
  }, [supabase]);

  // ------------------- Editor / seleção -------------------

  const loadIntoEditor = useCallback((s: TeleprompterScript | null, defaultFolder: string | null = null) => {
    setSelectedId(s?.id ?? null);
    setTitle(s?.title ?? "");
    setFolderId(s ? s.folder_id : defaultFolder);
    setRecordDate(s?.record_date ?? "");
    const html = s ? s.content_html ?? textToHtml(s.content) : "";
    setInitialHtml(html);
    setWordCount(s ? wordsOf(s.content) : 0);
    setPreviewText(s?.content ?? "");
    setEditorKey((k) => k + 1);
    setDirty(false);
  }, []);

  // Link vindo do chat do Helpinho (/teleprompter?roteiro=<id>): abre o roteiro no editor.
  const deepLinkHandledRef = useRef(false);
  useEffect(() => {
    if (loading || deepLinkHandledRef.current) return;
    const id = searchParams.get("roteiro");
    if (!id) return;
    deepLinkHandledRef.current = true;
    const found = scripts.find((s) => s.id === id);
    if (found) {
      loadIntoEditor(found);
      setTab("editor");
    } else {
      toast.error("Não encontrei esse roteiro no banco");
    }
  }, [loading, scripts, searchParams, loadIntoEditor]);

  /** Leva o roteiro atual para uma conversa nova com o Helpinho no chat. */
  function openInChat() {
    const text = editorRef.current?.getText().trim() ?? "";
    const header = selected
      ? `Quero continuar trabalhando neste roteiro do Teleprompter: "${selected.title}" (id: ${selected.id}).`
      : title.trim()
      ? `Quero trabalhar neste roteiro ainda não salvo: "${title.trim()}".`
      : "Quero trabalhar neste roteiro ainda não salvo.";
    const prompt = text ? `${header}\n\n${text}\n\nO que você sugere melhorar?` : `${header}`;
    try {
      window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ prompt }));
    } catch {
      // sem sessionStorage: abre o chat sem o texto
    }
    router.push("/assistente");
  }

  function selectScript(s: TeleprompterScript) {
    if (s.id === selectedId) {
      setTab("editor");
      return;
    }
    if (dirty && !confirm("Você tem alterações não salvas. Descartar e trocar de roteiro?")) return;
    loadIntoEditor(s);
    setTab("editor");
  }

  function handleNew() {
    if (dirty && !confirm("Você tem alterações não salvas. Descartar e criar um novo roteiro?")) return;
    loadIntoEditor(null, folderFilter !== "all" && folderFilter !== "none" ? folderFilter : null);
    setTab("editor");
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Dê um título para o roteiro");
      return;
    }
    const content = editorRef.current?.getText() ?? "";
    const content_html = editorRef.current?.getHTML() ?? null;
    const payload = { title: title.trim(), content, content_html, folder_id: folderId, record_date: recordDate || null };
    setSaving(true);
    try {
      if (selected) {
        const saved = await updateTeleprompterScript(supabase, selected.id, payload);
        setScripts((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
      } else {
        const saved = await createTeleprompterScript(supabase, me?.id || "", payload);
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
      if (selectedId === id) loadIntoEditor(null);
      toast.success("Roteiro excluído");
    } catch {
      toast.error("Erro ao excluir roteiro");
    } finally {
      setConfirmDeleteId(null);
    }
  }

  const toggleRecorded = useCallback(
    async (s: TeleprompterScript, next = !s.is_recorded) => {
      const optimistic = { ...s, is_recorded: next, recorded_at: next ? new Date().toISOString() : null };
      setScripts((prev) => prev.map((x) => (x.id === s.id ? optimistic : x)));
      try {
        const saved = await setTeleprompterRecorded(supabase, s.id, next);
        setScripts((prev) => prev.map((x) => (x.id === saved.id ? { ...x, is_recorded: saved.is_recorded, recorded_at: saved.recorded_at } : x)));
        toast.success(next ? "Marcado como gravado — saiu dos pendentes" : "Voltou para os pendentes");
      } catch {
        setScripts((prev) => prev.map((x) => (x.id === s.id ? s : x)));
        toast.error("Não foi possível atualizar o roteiro");
      }
    },
    [supabase]
  );

  // ------------------- Pastas -------------------

  async function submitFolder(value: { name: string; color: string }) {
    const dialog = folderDialog;
    if (!dialog) return;
    try {
      if (dialog.mode === "edit" && activeFolder) {
        const saved = await updateTeleprompterFolder(supabase, activeFolder.id, value);
        setFolders((prev) => prev.map((f) => (f.id === saved.id ? saved : f)).sort((a, b) => a.name.localeCompare(b.name)));
        toast.success("Pasta atualizada");
      } else {
        const saved = await createTeleprompterFolder(supabase, me?.id || "", value);
        setFolders((prev) => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
        if (dialog.forEditor) {
          setFolderId(saved.id);
          setDirty(true);
        } else {
          setFolderFilter(saved.id);
        }
        toast.success("Pasta criada");
      }
      setFolderDialog(null);
    } catch {
      toast.error("Não foi possível salvar a pasta");
    }
  }

  async function handleDeleteFolder(folder: TeleprompterFolder) {
    try {
      await deleteTeleprompterFolder(supabase, folder.id);
      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
      // os roteiros da pasta ficam sem pasta (on delete set null)
      setScripts((prev) => prev.map((s) => (s.folder_id === folder.id ? { ...s, folder_id: null } : s)));
      if (folderId === folder.id) setFolderId(null);
      if (folderFilter === folder.id) setFolderFilter("all");
      toast.success("Pasta excluída — os roteiros foram mantidos, sem pasta");
    } catch {
      toast.error("Erro ao excluir a pasta");
    } finally {
      setConfirmFolder(null);
    }
  }

  const activeFolder = folderFilter !== "all" && folderFilter !== "none" ? folders.find((f) => f.id === folderFilter) ?? null : null;
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);

  // ------------------- Listagem -------------------

  const pendingCount = scripts.filter((s) => !s.is_recorded).length;
  const recordedCount = scripts.length - pendingCount;

  const countsByFolder = useMemo(() => {
    const map = new Map<string, number>();
    let none = 0;
    for (const s of scripts) {
      if (s.is_recorded !== (view === "recorded")) continue;
      if (s.folder_id) map.set(s.folder_id, (map.get(s.folder_id) ?? 0) + 1);
      else none++;
    }
    return { map, none, all: scripts.filter((s) => s.is_recorded === (view === "recorded")).length };
  }, [scripts, view]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = scripts.filter((s) => {
      if (s.is_recorded !== (view === "recorded")) return false;
      if (folderFilter === "none" && s.folder_id) return false;
      if (folderFilter !== "all" && folderFilter !== "none" && s.folder_id !== folderFilter) return false;
      if (q && !s.title.toLowerCase().includes(q) && !s.content.toLowerCase().includes(q)) return false;
      return true;
    });
    if (view === "pending") {
      // pendentes: quem tem data de gravação mais próxima primeiro; sem data, por último
      return list.sort((a, b) => {
        if (a.record_date && b.record_date) return a.record_date.localeCompare(b.record_date);
        if (a.record_date) return -1;
        if (b.record_date) return 1;
        return b.updated_at.localeCompare(a.updated_at);
      });
    }
    return list.sort((a, b) => (b.recorded_at ?? "").localeCompare(a.recorded_at ?? ""));
  }, [scripts, view, folderFilter, query]);

  // contagens por pasta (independem da aba Pendentes/Gravados): alimentam a grade de pastas
  const folderStats = useMemo(() => {
    const today = todayStr();
    const map = new Map<string, { pending: number; recorded: number; overdue: number; total: number }>();
    for (const s of scripts) {
      const key = s.folder_id ?? "none";
      const st = map.get(key) ?? { pending: 0, recorded: 0, overdue: 0, total: 0 };
      st.total++;
      if (s.is_recorded) st.recorded++;
      else {
        st.pending++;
        if (s.record_date && s.record_date < today) st.overdue++;
      }
      map.set(key, st);
    }
    return map;
  }, [scripts]);

  // Pastas: na raiz mostra os cartões de pasta; ao buscar, cai na lista de resultados
  const showFolderGrid = layout === "folders" && folderFilter === "all" && !query.trim();

  const overdueCount = scripts.filter((s) => !s.is_recorded && s.record_date && s.record_date < todayStr()).length;

  // ------------------- Palco -------------------

  function openStage(selection: string, selfie = false) {
    const text = selection || editorRef.current?.getText() || "";
    stageRef.current?.open({ text, selfie });
  }

  function handleRecordingSaved() {
    if (selected && !selected.is_recorded) void toggleRecorded(selected, true);
  }

  const readSeconds = Math.round((wordCount / 150) * 60);
  const readLabel = readSeconds < 60 ? `${readSeconds}s` : `${Math.floor(readSeconds / 60)}min ${String(readSeconds % 60).padStart(2, "0")}s`;

  const NAV_TABS = [
    { key: "scripts" as const, label: "Roteiros", icon: FileText, badge: pendingCount > 0 ? String(pendingCount) : null, hint: "pendentes", mobileOnly: false },
    { key: "editor" as const, label: "Editor", icon: PenLine, badge: dirty ? "•" : null, hint: selected ? selected.title : title || "novo roteiro", mobileOnly: false },
    { key: "ai" as const, label: "Helpinho", icon: Sparkles, badge: null, hint: "escrever com IA", mobileOnly: true },
    { key: "stage" as const, label: "Teleprompter", icon: MonitorPlay, badge: null, hint: `${fontSize}px · vel. ${speed}`, mobileOnly: false },
  ];

  const editorVisible = tab === "editor" || tab === "ai";

  return (
    <div className="pb-24 md:pb-0">
      {/* Banner (compacto no celular) */}
      <div className="ast-fade-up relative mb-4 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 p-4 text-white sm:mb-5 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-12 h-52 w-52 rounded-full bg-yellow-500/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-sky-400/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-3 sm:gap-4">
          <span className="ast-float flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-yellow-500 text-blue-900 shadow-lg sm:h-14 sm:w-14">
            <MonitorPlay className="h-6 w-6 sm:h-7 sm:w-7" />
          </span>
          <div className="min-w-0 flex-1 basis-40">
            <h1 className="font-display text-xl font-bold sm:text-2xl">Teleprompter</h1>
            <p className="mt-0.5 hidden text-sm text-blue-100 sm:block">
              Escreva no editor, peça ajuda ao Helpinho (que escreve no estilo do Rober), selecione um trecho e mande para o teleprompter.
            </p>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Button onClick={handleNew} variant="secondary" className="gap-1.5 border-white/40 bg-white/10 text-white hover:bg-white/20">
              <Plus className="h-4 w-4" /> Novo roteiro
            </Button>
            <Button onClick={() => openStage(editorRef.current?.getSelectionText() ?? "")} disabled={wordCount === 0} className="gap-1.5">
              <Play className="h-4 w-4" /> Abrir teleprompter
            </Button>
          </div>
        </div>
        <div className="relative mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold sm:mt-4 sm:gap-2 sm:text-xs">
          <span className="rounded-full bg-white/10 px-2.5 py-1">{pendingCount} {pendingCount === 1 ? "pendente" : "pendentes"}</span>
          <span className="rounded-full bg-white/10 px-2.5 py-1">{recordedCount} {recordedCount === 1 ? "gravado" : "gravados"}</span>
          {overdueCount > 0 && <span className="rounded-full bg-red-500/90 px-2.5 py-1">{overdueCount} atrasado{overdueCount === 1 ? "" : "s"}</span>}
        </div>
      </div>

      {/* Abas — tablet/desktop (no celular elas ficam na barra inferior) */}
      <div className="sticky top-0 z-20 -mx-1 mb-5 hidden bg-gradient-to-b from-white via-white to-transparent px-1 pb-2 pt-1 md:block">
        <div className="flex gap-1 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-[var(--shadow-sm)]" role="tablist">
          {NAV_TABS.filter((t) => !t.mobileOnly).map((t) => {
            const Icon = t.icon;
            const active = tab === t.key || (t.key === "editor" && tab === "ai");
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={cn(
                  "group flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3.5 py-2 text-left transition-all duration-200",
                  active ? "bg-blue-900 text-white shadow-md" : "text-gray-600 hover:bg-gray-050"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110",
                    active ? "bg-yellow-500 text-blue-900" : "bg-blue-050 text-blue-800"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="flex items-center gap-1.5 font-display text-sm font-bold">
                    {t.label}
                    {t.badge && (
                      <span
                        key={t.badge}
                        className={cn(
                          "ast-pop rounded-full px-1.5 text-[11px]",
                          t.key === "editor" ? "bg-yellow-500 text-blue-900" : active ? "bg-white/20" : "bg-gray-200 text-gray-700"
                        )}
                      >
                        {t.badge}
                      </span>
                    )}
                  </span>
                  <span className={cn("block max-w-[160px] truncate text-[11px]", active ? "text-blue-100" : "text-gray-400")}>{t.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Barra de abas inferior — celular */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Seções do teleprompter"
      >
        <div className="mx-auto flex max-w-lg items-stretch px-1.5 py-1.5" role="tablist">
          {NAV_TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            const isAi = t.key === "ai";
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className="group relative flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 outline-none transition-colors active:bg-gray-100"
              >
                <span
                  className={cn(
                    "relative flex h-9 w-14 items-center justify-center rounded-full transition-all duration-200",
                    active
                      ? isAi
                        ? "bg-yellow-500 text-blue-900 shadow-md shadow-yellow-500/30"
                        : "bg-blue-900 text-white"
                      : isAi
                      ? "bg-yellow-100 text-yellow-700"
                      : "text-gray-500"
                  )}
                >
                  <Icon className={cn("h-5 w-5 transition-transform duration-200", active && "scale-110")} />
                  {t.badge && (
                    <span
                      key={t.badge}
                      className="ast-pop absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-yellow-500 px-1 text-center text-[10px] font-bold leading-[18px] text-blue-900 ring-2 ring-white"
                    >
                      {t.badge}
                    </span>
                  )}
                </span>
                <span className={cn("text-[11px] font-bold", active ? "text-blue-900" : "text-gray-500")}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div>
        {/* ---------------- Aba: Roteiros ---------------- */}
        <div className={tab === "scripts" ? "" : "hidden"}>
          <Card className="ast-fade-up flex min-h-[380px] flex-col p-0">
            <div className="space-y-3 border-b border-gray-100 p-3 sm:p-4">
              {/* Pendentes / Gravados */}
              <div className="flex rounded-full bg-gray-100 p-1" role="tablist">
                {([
                  { key: "pending", label: "Pendentes", count: pendingCount },
                  { key: "recorded", label: "Gravados", count: recordedCount },
                ] as const).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={view === t.key}
                    onClick={() => setView(t.key)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-all sm:py-1.5",
                      view === t.key ? "bg-blue-900 text-white shadow-sm" : "text-gray-600 hover:text-blue-900"
                    )}
                  >
                    {t.key === "recorded" && <Check className="h-3.5 w-3.5" />}
                    {t.label}
                    <span className={cn("rounded-full px-1.5 text-[11px]", view === t.key ? "bg-white/20" : "bg-gray-200")}>{t.count}</span>
                  </button>
                ))}
              </div>

              {/* Modo de visualização + nova pasta */}
              <div className="flex items-center gap-2">
                <div className="flex rounded-full bg-gray-100 p-1" role="group" aria-label="Modo de visualização">
                  {([
                    { key: "folders", label: "Pastas", icon: Folder },
                    { key: "list", label: "Lista", icon: List },
                  ] as const).map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setLayout(m.key)}
                        aria-pressed={layout === m.key}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all",
                          layout === m.key ? "bg-white text-blue-900 shadow-sm" : "text-gray-500 hover:text-blue-900"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" /> {m.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setFolderDialog({ mode: "create" })}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-2 text-xs font-bold text-blue-800 transition-colors hover:bg-blue-050 active:scale-95 sm:py-1.5"
                >
                  <FolderPlus className="h-3.5 w-3.5" /> Nova pasta
                </button>
              </div>

              {/* Lista: chips de pasta (rolagem horizontal no celular) */}
              {layout === "list" && (
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {[
                    { key: "all", label: "Todas", color: "#375367", count: countsByFolder.all },
                    { key: "none", label: "Sem pasta", color: "#7c8e98", count: countsByFolder.none },
                    ...folders.map((f) => ({ key: f.id, label: f.name, color: f.color, count: countsByFolder.map.get(f.id) ?? 0 })),
                  ].map((f) => {
                    const active = folderFilter === f.key;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setFolderFilter(f.key)}
                        aria-pressed={active}
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
                          active ? "border-transparent text-white shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                        )}
                        style={active ? { backgroundColor: f.color } : undefined}
                      >
                        {!active && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: f.color }} />}
                        <span className="max-w-[140px] truncate">{f.label}</span>
                        <span className={cn("text-[10px]", active ? "text-white/80" : "text-gray-400")}>{f.count}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Pastas: dentro de uma pasta -> voltar + ações */}
              {layout === "folders" && folderFilter !== "all" && (
                <div className="ast-fade-up flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFolderFilter("all")}
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-050 px-3.5 py-2 text-xs font-bold text-blue-800 transition-all hover:bg-blue-100 active:scale-95"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Pastas
                  </button>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 font-display text-sm font-bold text-blue-900">
                    <FolderOpen className="h-4 w-4 shrink-0" style={{ color: activeFolder?.color ?? "#7c8e98" }} />
                    <span className="truncate">{activeFolder?.name ?? "Sem pasta"}</span>
                    <span className="shrink-0 text-xs font-semibold text-gray-400">{visible.length}</span>
                  </span>
                  {activeFolder && (
                    <>
                      <button
                        type="button"
                        onClick={() => setFolderDialog({ mode: "edit" })}
                        className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-900"
                        aria-label="Renomear pasta"
                        title="Renomear pasta"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmFolder(activeFolder)}
                        className="rounded-full p-2 text-gray-400 hover:bg-[color:var(--color-danger-bg)] hover:text-[color:var(--color-danger)]"
                        aria-label="Excluir pasta"
                        title="Excluir pasta"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  <Button size="sm" onClick={handleNew} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Novo aqui
                  </Button>
                </div>
              )}

              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={layout === "folders" && folderFilter === "all" ? "Buscar em todas as pastas..." : "Buscar roteiro..."}
                  aria-label="Buscar roteiro"
                  className="h-11 w-full rounded-full border border-gray-200 bg-gray-050 pl-10 pr-3 text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-900 focus:bg-white focus:shadow-[var(--shadow-focus)] sm:h-10"
                  style={{ fontSize: 16 }}
                />
              </div>
            </div>

            {showFolderGrid ? (
              /* ---- Grade de pastas ---- */
              <div className="grid grid-cols-2 content-start gap-2.5 p-3 sm:gap-3 sm:p-4 md:grid-cols-3 xl:grid-cols-4">
                {loading ? (
                  [0, 1, 2, 3].map((i) => <div key={i} className="ast-skeleton h-32 rounded-2xl" style={{ animationDelay: `${i * 100}ms` }} />)
                ) : (
                  <>
                    {[
                      ...folders.map((f) => ({ key: f.id, name: f.name, color: f.color, virtual: false })),
                      { key: "none", name: "Sem pasta", color: "#7c8e98", virtual: true },
                    ]
                      .filter((f) => !f.virtual || (folderStats.get("none")?.total ?? 0) > 0)
                      .map((f, i) => {
                        const st = folderStats.get(f.key) ?? { pending: 0, recorded: 0, overdue: 0, total: 0 };
                        return (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => setFolderFilter(f.key)}
                            style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                            className="kb-card-in group relative flex min-h-[8rem] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-3.5 text-left shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-md)] active:translate-y-0 active:scale-[0.98]"
                          >
                            <span className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: f.color }} aria-hidden />
                            <span
                              className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110"
                              style={{ backgroundColor: `${f.color}26`, color: f.color }}
                            >
                              <Folder className="h-6 w-6 group-hover:hidden" />
                              <FolderOpen className="hidden h-6 w-6 group-hover:block" />
                            </span>
                            <span className="mt-2.5 block truncate font-display text-sm font-bold text-blue-900">{f.name}</span>
                            <span className="mt-0.5 block text-xs text-gray-500">
                              {st.pending} {st.pending === 1 ? "pendente" : "pendentes"} · {st.recorded} {st.recorded === 1 ? "gravado" : "gravados"}
                            </span>
                            {st.overdue > 0 && (
                              <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-full bg-[color:var(--color-danger-bg)] px-2 py-0.5 pt-0.5 text-[10px] font-bold text-[color:var(--color-danger)]">
                                <CalendarClock className="h-3 w-3" /> {st.overdue} atrasado{st.overdue === 1 ? "" : "s"}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    <button
                      type="button"
                      onClick={() => setFolderDialog({ mode: "create" })}
                      className="flex min-h-[8rem] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500 transition-all hover:border-yellow-500 hover:bg-yellow-050 hover:text-blue-900 active:scale-[0.98]"
                    >
                      <FolderPlus className="h-6 w-6" />
                      <span className="text-xs font-bold">Nova pasta</span>
                    </button>
                  </>
                )}
              </div>
            ) : (
              /* ---- Roteiros (lista / dentro da pasta / busca) ---- */
              <div className="grid content-start gap-2.5 p-3 sm:p-4 md:grid-cols-2 2xl:grid-cols-3">
                {layout === "folders" && folderFilter === "all" && query.trim() && (
                  <p className="col-span-full text-xs font-semibold text-gray-400">Resultados em todas as pastas</p>
                )}
                {loading ? (
                  [0, 1, 2].map((i) => <div key={i} className="ast-skeleton h-24 rounded-2xl" style={{ animationDelay: `${i * 100}ms` }} />)
                ) : visible.length === 0 ? (
                  <div className="col-span-full">
                    <EmptyState
                      icon={view === "pending" ? FileText : Check}
                      title={
                        query
                          ? "Nenhum roteiro encontrado"
                          : view === "pending"
                          ? scripts.length === 0
                            ? "Nenhum roteiro salvo"
                            : "Tudo gravado por aqui!"
                          : "Nada gravado ainda"
                      }
                      description={
                        query
                          ? "Tente outro termo."
                          : view === "pending"
                          ? scripts.length === 0
                            ? "Crie um roteiro e salve para reutilizar depois."
                            : "Não há roteiros pendentes neste filtro."
                          : "Marque o check de um roteiro quando gravar."
                      }
                    />
                  </div>
                ) : (
                  visible.map((s, i) => {
                    const active = selectedId === s.id;
                    const folder = s.folder_id ? folderById.get(s.folder_id) : undefined;
                    const late = !s.is_recorded && !!s.record_date && s.record_date < todayStr();
                    return (
                      <div
                        key={s.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => selectScript(s)}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectScript(s);
                          }
                        }}
                        style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                        className={cn(
                          "kb-card-in group relative cursor-pointer overflow-hidden rounded-2xl border py-3 pl-3 pr-3 outline-none transition-all duration-200 active:scale-[0.99]",
                          "focus-visible:ring-2 focus-visible:ring-blue-900",
                          active ? "border-yellow-400 bg-yellow-050 shadow-[var(--shadow-sm)]" : "border-gray-200 bg-white hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-[var(--shadow-md)]"
                        )}
                      >
                        {folder && <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: folder.color }} aria-hidden />}
                        <div className="flex items-start gap-2.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void toggleRecorded(s);
                            }}
                            aria-label={s.is_recorded ? "Desmarcar como gravado" : "Marcar como gravado"}
                            aria-pressed={s.is_recorded}
                            title={s.is_recorded ? "Gravado — clique para voltar aos pendentes" : "Marcar como gravado"}
                            className={cn(
                              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90 sm:h-6 sm:w-6",
                              s.is_recorded
                                ? "border-[color:var(--color-success)] bg-[color:var(--color-success)] text-white"
                                : "border-gray-300 text-transparent hover:border-[color:var(--color-success)] hover:text-[color:var(--color-success)]"
                            )}
                          >
                            <Check className="h-4 w-4 sm:h-3.5 sm:w-3.5" strokeWidth={3} />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={cn("truncate text-sm font-bold text-blue-900", s.is_recorded && "text-gray-500 line-through decoration-gray-300")}>{s.title}</p>
                            {s.content && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{s.content}</p>}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                              {s.is_recorded && s.recorded_at ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-success-bg)] px-2 py-0.5 text-[color:var(--color-success)]">
                                  <Check className="h-3 w-3" /> Gravado em {format(parseISO(s.recorded_at), "dd/MM")}
                                </span>
                              ) : s.record_date ? (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                                    late ? "bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]" : "bg-blue-050 text-blue-800"
                                  )}
                                >
                                  <CalendarClock className="h-3 w-3" />
                                  {late ? "Atrasado · " : "Gravar "}
                                  {shortDate(s.record_date)}
                                </span>
                              ) : (
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">Sem data de gravação</span>
                              )}
                              {folder && (layout === "list" || folderFilter === "all") && (
                                <span className="inline-flex max-w-[120px] items-center gap-1 truncate rounded-full px-2 py-0.5 text-white" style={{ backgroundColor: folder.color }}>
                                  <Folder className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{folder.name}</span>
                                </span>
                              )}
                              <span className="text-gray-400">{agoLabel(s.updated_at)}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(s.id);
                            }}
                            className="shrink-0 rounded-full p-1.5 text-gray-400 opacity-100 transition-opacity hover:bg-white hover:text-[color:var(--color-danger)] sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                            title="Excluir"
                            aria-label={`Excluir roteiro ${s.title}`}
                          >
                            <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </Card>
        </div>

        {/* ---------------- Aba: Editor (+ Helpinho) ---------------- */}
        <div className={cn("min-w-0", editorVisible ? "" : "hidden")}>
          <Card className="ast-fade-up space-y-3 p-3 sm:space-y-4 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTab("scripts")}
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-050 px-3.5 py-2 text-xs font-bold text-blue-800 transition-all hover:bg-blue-100 active:scale-95"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Roteiros
              </button>
              <span className="min-w-0 truncate text-xs text-gray-400">{selected ? "Editando roteiro salvo" : "Novo roteiro"}</span>
              {dirty && (
                <span className="ast-pop inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-2.5 py-1 text-[11px] font-bold text-blue-900">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-600" /> não salvo
                </span>
              )}
              <span className="ml-auto" />
              <Button size="sm" variant="secondary" onClick={() => setTab("stage")} className="hidden gap-1.5 sm:inline-flex">
                <MonitorPlay className="h-3.5 w-3.5" /> Ajustes do teleprompter
              </Button>
            </div>

            {/* No celular, com a aba do Helpinho aberta, os campos e o editor somem para dar espaço à IA */}
            <div className={cn("space-y-3 sm:space-y-4", tab === "ai" && "hidden lg:block")}>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-[1fr_200px_170px]">
                <div className="col-span-2 min-w-0 md:col-span-1">
                  <Label htmlFor="tp-title">Título do roteiro</Label>
                  <Input
                    id="tp-title"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setDirty(true);
                    }}
                    placeholder="Ex: Reels sobre multas de trânsito"
                    style={{ fontSize: 16 }}
                  />
                </div>
                <div className="col-span-2 min-w-0 md:col-span-1">
                  <Label htmlFor="tp-folder">Pasta</Label>
                  <div className="flex gap-1.5">
                    <div className="min-w-0 flex-1">
                      <Select
                        id="tp-folder"
                        value={folderId ?? ""}
                        style={{ fontSize: 16 }}
                        onChange={(e) => {
                          setFolderId(e.target.value || null);
                          setDirty(true);
                        }}
                      >
                        <option value="">Sem pasta</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </Select>
                    </div>
                    <Button type="button" size="icon" variant="secondary" onClick={() => setFolderDialog({ mode: "create", forEditor: true })} aria-label="Criar nova pasta" title="Criar nova pasta" className="h-10 w-10 shrink-0">
                      <FolderPlus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="col-span-2 min-w-0 md:col-span-1">
                  <Label htmlFor="tp-date">Data de gravação</Label>
                  <Input
                    id="tp-date"
                    type="date"
                    value={recordDate}
                    style={{ fontSize: 16 }}
                    onChange={(e) => {
                      setRecordDate(e.target.value);
                      setDirty(true);
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                  <Save className="h-4 w-4" /> {saving ? "Salvando..." : selected ? "Atualizar" : "Salvar"}
                </Button>
                {selected && (
                  <button
                    type="button"
                    onClick={() => void toggleRecorded(selected)}
                    aria-pressed={selected.is_recorded}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-full border-2 px-4 font-display text-sm font-semibold transition-all active:scale-95",
                      selected.is_recorded
                        ? "border-[color:var(--color-success)] bg-[color:var(--color-success)] text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:border-[color:var(--color-success)] hover:text-[color:var(--color-success)]"
                    )}
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                    {selected.is_recorded ? "Gravado" : "Marcar como gravado"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAiOpen((v) => !v)}
                  aria-pressed={aiOpen}
                  className={cn(
                    "ml-auto hidden h-10 items-center gap-2 rounded-full border-2 px-4 font-display text-sm font-semibold transition-all active:scale-95 lg:inline-flex",
                    aiOpen ? "border-blue-900 bg-blue-900 text-white" : "border-blue-900 bg-white text-blue-900 hover:bg-blue-050"
                  )}
                >
                  <Sparkles className={cn("h-4 w-4", aiOpen && "text-yellow-400")} /> Helpinho
                </button>
              </div>
            </div>

            <div className={cn("grid gap-4", aiOpen && "lg:grid-cols-[minmax(0,1fr)_340px]")}>
              <div className={cn("min-w-0", tab === "ai" && "hidden lg:block")}>
                <ScriptEditor
                  key={editorKey}
                  ref={editorRef}
                  initialHtml={initialHtml}
                  onChange={(_html, text) => {
                    setDirty(true);
                    setWordCount(wordsOf(text));
                    setPreviewText(text);
                  }}
                  onSend={(selection) => openStage(selection)}
                  className="h-[calc(100dvh-380px)] min-h-[340px] lg:h-[560px]"
                />
              </div>
              <div className={cn("ast-fade-up min-h-0", tab === "ai" ? "block" : "hidden", aiOpen ? "lg:block" : "lg:hidden")}>
                <AiPanel
                  className="min-h-[calc(100dvh-250px)] lg:h-[560px] lg:min-h-0"
                  scriptId={selectedId}
                  contextLabel={`${title.trim() || "Roteiro sem título"} · ${wordCount} palavras`}
                  onOpenChat={openInChat}
                  getFullText={() => editorRef.current?.getText() ?? ""}
                  getSelectionText={() => editorRef.current?.getSelectionText() ?? ""}
                  onUse={(text, replaceSelection) => {
                    if (replaceSelection) editorRef.current?.replaceSelectionOrAppend(text);
                    else editorRef.current?.setText(text);
                    setDirty(true);
                    // no celular a IA é uma aba: depois de usar o texto, volta para o editor
                    if (tab === "ai") setTab("editor");
                  }}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* ---------------- Aba: Teleprompter ---------------- */}
        <div className={cn("min-w-0", tab === "stage" ? "" : "hidden")}>
          <Card className="ast-fade-up grid gap-4 p-3 sm:p-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-sm font-bold text-blue-900">Ajustes do teleprompter</p>
                <button
                  type="button"
                  onClick={() => setTab("editor")}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-blue-050 px-3.5 py-2 text-xs font-bold text-blue-800 transition-all hover:bg-blue-100 active:scale-95"
                >
                  <PenLine className="h-3.5 w-3.5" /> Voltar ao editor
                </button>
              </div>
              <div className="rounded-2xl bg-blue-050 px-3.5 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">Roteiro atual</p>
                <p className="truncate font-display text-sm font-bold text-blue-900">{title.trim() || "Sem título"}</p>
                <p className="text-xs text-blue-800/80">{wordCount} palavras · leitura ~ {readLabel}</p>
                <Button onClick={() => openStage(editorRef.current?.getSelectionText() ?? "")} disabled={wordCount === 0} className="mt-2.5 h-12 w-full gap-1.5 text-base">
                  <Play className="h-5 w-5" /> Abrir teleprompter
                </Button>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
                    <Type className="h-3.5 w-3.5" /> Fonte
                  </span>
                  <span className="rounded-full bg-blue-050 px-2 py-0.5 text-xs font-bold text-blue-900">{fontSize}px</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="secondary" onClick={() => setFontSize((f) => Math.max(MIN_FONT, f - 4))} aria-label="Diminuir fonte" className="h-11 w-11 shrink-0">
                    <Minus className="h-4 w-4" />
                  </Button>
                  <input type="range" min={MIN_FONT} max={MAX_FONT} step={4} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} aria-label="Tamanho da fonte" className="h-2 min-w-0 flex-1 cursor-pointer accent-[var(--yellow-500)]" />
                  <Button size="icon" variant="secondary" onClick={() => setFontSize((f) => Math.min(MAX_FONT, f + 4))} aria-label="Aumentar fonte" className="h-11 w-11 shrink-0">
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
                  <Button size="icon" variant="secondary" onClick={() => setSpeed((v) => Math.max(MIN_SPEED, v - 1))} aria-label="Diminuir velocidade" className="h-11 w-11 shrink-0">
                    <Minus className="h-4 w-4" />
                  </Button>
                  <input type="range" min={MIN_SPEED} max={MAX_SPEED} step={1} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Velocidade de rolagem" className="h-2 min-w-0 flex-1 cursor-pointer accent-[var(--yellow-500)]" />
                  <Button size="icon" variant="secondary" onClick={() => setSpeed((v) => Math.min(MAX_SPEED, v + 1))} aria-label="Aumentar velocidade" className="h-11 w-11 shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMirrored((m) => !m)}
                  aria-pressed={mirrored}
                  title="Espelhar texto (para vidro de teleprompter físico)"
                  className={cn(
                    "inline-flex h-12 items-center justify-center gap-1.5 rounded-full border-2 px-3 font-display text-sm font-semibold transition-all active:scale-95",
                    mirrored ? "border-blue-900 bg-blue-900 text-white" : "border-blue-900 bg-white text-blue-900 hover:bg-blue-050"
                  )}
                >
                  {mirrored ? <ChevronsRightLeft className="h-4 w-4" /> : <ChevronsLeftRight className="h-4 w-4" />}
                  {mirrored ? "Espelhado" : "Normal"}
                </button>
                <button
                  type="button"
                  onClick={() => openStage(editorRef.current?.getSelectionText() ?? "", true)}
                  disabled={wordCount === 0}
                  title="Gravar em modo selfie com teleprompter na tela"
                  className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full border-2 border-blue-900 bg-white px-3 font-display text-sm font-semibold text-blue-900 transition-all hover:bg-blue-050 active:scale-95 disabled:opacity-40"
                >
                  <Camera className="h-4 w-4" /> Gravar selfie
                </button>
              </div>
              <p className="hidden text-xs text-gray-500 md:block">
                No teleprompter: <kbd className="font-sans font-bold">Espaço</kbd> play/pausa, <kbd className="font-sans font-bold">↑ ↓</kbd> velocidade,{" "}
                <kbd className="font-sans font-bold">M</kbd> espelhar.
              </p>
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
                  style={{ fontSize: `${Math.max(12, Math.round(fontSize * 0.42))}px`, transform: mirrored ? "scaleX(-1)" : undefined }}
                >
                  {previewText.slice(0, 220) || "Seu texto aparece aqui…"}
                </p>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black to-transparent" aria-hidden />
              </div>
            </div>
          </Card>
        </div>
      </div>

      <TeleprompterStage
        ref={stageRef}
        fontSize={fontSize}
        onFontSize={setFontSize}
        speed={speed}
        onSpeed={setSpeed}
        mirrored={mirrored}
        onMirrored={setMirrored}
        title={title}
        onRecordingSaved={handleRecordingSaved}
      />

      <FolderDialog
        open={!!folderDialog}
        initial={folderDialog?.mode === "edit" && activeFolder ? { name: activeFolder.name, color: activeFolder.color } : null}
        onClose={() => setFolderDialog(null)}
        onSubmit={submitFolder}
      />

      <ConfirmDialog
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        title="Excluir roteiro"
        description="Tem certeza que deseja excluir este roteiro do banco?"
        confirmLabel="Excluir"
        danger
      />

      <ConfirmDialog
        open={!!confirmFolder}
        onClose={() => setConfirmFolder(null)}
        onConfirm={() => confirmFolder && handleDeleteFolder(confirmFolder)}
        title="Excluir pasta"
        description={`Os roteiros da pasta "${confirmFolder?.name}" não serão apagados: ficam em "Sem pasta".`}
        confirmLabel="Excluir pasta"
        danger
      />
    </div>
  );
}
