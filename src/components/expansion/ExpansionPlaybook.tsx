"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, FileText, Folder, FolderOpen, FolderPlus, Loader2, Pencil, Plus, Save, Sparkles, Trash2, Upload, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FolderDialog } from "@/components/teleprompter/FolderDialog";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  createExpansionDoc, createExpansionFolder, deleteExpansionDoc, deleteExpansionFolder, listExpansionDocs,
  listExpansionFolders, updateExpansionDoc, updateExpansionFolder,
} from "@/lib/services/expansionPlaybook";
import { cn } from "@/lib/utils";
import type { ExpansionDoc, ExpansionFolder } from "@/types/database";

const IMPORT_ACCEPT = ".pdf,.docx,.xlsx,.csv,.txt,.md";

const KIND_LABEL: Record<ExpansionDoc["kind"], string> = { roteiro: "Roteiro", reuniao: "Reunião" };

function ago(iso: string) {
  try {
    return formatDistanceToNow(parseISO(iso), { locale: ptBR, addSuffix: true });
  } catch {
    return "";
  }
}

type Draft = { id: string | null; title: string; kind: ExpansionDoc["kind"]; content: string };

export function ExpansionPlaybook() {
  const supabase = useMemo(() => createClient(), []);
  const { profile: me } = useAuth();
  const [folders, setFolders] = useState<ExpansionFolder[]>([]);
  const [docs, setDocs] = useState<ExpansionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [folderDialog, setFolderDialog] = useState<"create" | "edit" | null>(null);
  const [confirmFolder, setConfirmFolder] = useState<ExpansionFolder | null>(null);
  const [confirmDoc, setConfirmDoc] = useState<ExpansionDoc | null>(null);
  const [importing, setImporting] = useState(false);
  const [importedFrom, setImportedFrom] = useState<{ name: string; ai: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // o aviso de "importado de…" vale só para o rascunho que veio do arquivo
  useEffect(() => {
    if (!draft || draft.id) setImportedFrom(null);
  }, [draft]);

  useEffect(() => {
    Promise.all([listExpansionFolders(supabase), listExpansionDocs(supabase)])
      .then(([f, d]) => {
        setFolders(f);
        setDocs(d);
      })
      .catch(() => toast.error("Não foi possível carregar as pastas"))
      .finally(() => setLoading(false));
  }, [supabase]);

  const folder = folders.find((f) => f.id === folderId) ?? null;
  const folderDocs = docs.filter((d) => d.folder_id === folderId);

  function closeDraft() {
    if (dirty && !confirm("Você tem alterações não salvas. Descartar?")) return;
    setDraft(null);
    setDirty(false);
  }

  function openDoc(d: ExpansionDoc) {
    setDraft({ id: d.id, title: d.title, kind: d.kind, content: d.content });
    setDirty(false);
  }

  function newDoc(kind: ExpansionDoc["kind"]) {
    setDraft({ id: null, title: "", kind, content: "" });
    setDirty(false);
  }

  /** Lê o arquivo no servidor, o Helpinho organiza no padrão e o resultado abre como rascunho não salvo. */
  async function importFile(file: File) {
    if (dirty && !confirm("Você tem alterações não salvas. Descartar e importar o arquivo?")) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Arquivo grande demais (máx. 4 MB)");
      return;
    }
    const body = new FormData();
    body.append("file", file);
    setImporting(true);
    try {
      const res = await fetch("/api/expansao/importar", { method: "POST", body });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error || "Não foi possível importar o arquivo");
      setDraft({ id: null, title: data.title, kind: data.kind, content: data.content });
      setDirty(true);
      setImportedFrom({ name: file.name, ai: !!data.ai });
      if (data.warning) toast.warning(data.warning);
      else toast.success("Arquivo organizado pelo Helpinho — revise e salve");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível importar o arquivo");
    } finally {
      setImporting(false);
    }
  }

  function edit(patch: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  }

  async function saveDraft() {
    if (!draft || !folderId) return;
    if (!draft.title.trim()) {
      toast.error("Dê um título");
      return;
    }
    const input = { folder_id: folderId, kind: draft.kind, title: draft.title.trim(), content: draft.content };
    setSaving(true);
    try {
      if (draft.id) {
        const saved = await updateExpansionDoc(supabase, draft.id, input);
        setDocs((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
      } else {
        const saved = await createExpansionDoc(supabase, me?.id || "", input);
        setDocs((prev) => [saved, ...prev]);
        setDraft({ ...draft, id: saved.id });
      }
      setDirty(false);
      toast.success("Salvo");
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function removeDoc(d: ExpansionDoc) {
    try {
      await deleteExpansionDoc(supabase, d.id);
      setDocs((prev) => prev.filter((x) => x.id !== d.id));
      if (draft?.id === d.id) {
        setDraft(null);
        setDirty(false);
      }
      toast.success("Excluído");
    } catch {
      toast.error("Erro ao excluir");
    } finally {
      setConfirmDoc(null);
    }
  }

  async function submitFolder(value: { name: string; color: string }) {
    try {
      if (folderDialog === "edit" && folder) {
        const saved = await updateExpansionFolder(supabase, folder.id, value);
        setFolders((prev) => prev.map((f) => (f.id === saved.id ? saved : f)).sort((a, b) => a.name.localeCompare(b.name)));
        toast.success("Pasta atualizada");
      } else {
        const saved = await createExpansionFolder(supabase, me?.id || "", value);
        setFolders((prev) => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
        setFolderId(saved.id);
        toast.success("Pasta criada");
      }
      setFolderDialog(null);
    } catch {
      toast.error("Não foi possível salvar a pasta");
    }
  }

  async function removeFolder(f: ExpansionFolder) {
    try {
      await deleteExpansionFolder(supabase, f.id);
      setFolders((prev) => prev.filter((x) => x.id !== f.id));
      setDocs((prev) => prev.filter((d) => d.folder_id !== f.id));
      setFolderId(null);
      setDraft(null);
      setDirty(false);
      toast.success("Pasta excluída");
    } catch {
      toast.error("Erro ao excluir a pasta");
    } finally {
      setConfirmFolder(null);
    }
  }

  return (
    <Card className="ast-fade-up flex min-h-[380px] flex-col p-0">
      {!folder ? (
        <div className="grid grid-cols-2 content-start gap-2.5 p-3 sm:gap-3 sm:p-4 md:grid-cols-3 xl:grid-cols-4">
          {loading ? (
            [0, 1, 2, 3].map((i) => <div key={i} className="ast-skeleton h-32 rounded-2xl" />)
          ) : (
            <>
              {folders.map((f, i) => {
                const own = docs.filter((d) => d.folder_id === f.id);
                const roteiros = own.filter((d) => d.kind === "roteiro").length;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFolderId(f.id)}
                    style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                    className="kb-card-in group relative flex min-h-[8rem] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-3.5 text-left shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-md)] active:scale-[0.98]"
                  >
                    <span className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: f.color }} aria-hidden />
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110" style={{ backgroundColor: `${f.color}26`, color: f.color }}>
                      <Folder className="h-6 w-6 group-hover:hidden" />
                      <FolderOpen className="hidden h-6 w-6 group-hover:block" />
                    </span>
                    <span className="mt-2.5 block truncate font-display text-sm font-bold text-blue-900">{f.name}</span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {roteiros} {roteiros === 1 ? "roteiro" : "roteiros"} · {own.length - roteiros} {own.length - roteiros === 1 ? "reunião" : "reuniões"}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setFolderDialog("create")}
                className="flex min-h-[8rem] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500 transition-all hover:border-yellow-500 hover:bg-yellow-050 hover:text-blue-900 active:scale-[0.98]"
              >
                <FolderPlus className="h-6 w-6" />
                <span className="text-xs font-bold">Nova pasta</span>
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-3 sm:p-4">
            <button
              type="button"
              onClick={() => {
                if (dirty && !confirm("Você tem alterações não salvas. Descartar?")) return;
                setDraft(null);
                setDirty(false);
                setFolderId(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-050 px-3.5 py-2 text-xs font-bold text-blue-800 transition-all hover:bg-blue-100 active:scale-95"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Pastas
            </button>
            <span className="flex min-w-0 flex-1 items-center gap-1.5 font-display text-sm font-bold text-blue-900">
              <FolderOpen className="h-4 w-4 shrink-0" style={{ color: folder.color }} />
              <span className="truncate">{folder.name}</span>
              <span className="shrink-0 text-xs font-semibold text-gray-400">{folderDocs.length}</span>
            </span>
            <button type="button" onClick={() => setFolderDialog("edit")} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-900" aria-label="Renomear pasta" title="Renomear pasta">
              <Pencil className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setConfirmFolder(folder)} className="rounded-full p-2 text-gray-400 hover:bg-[color:var(--color-danger-bg)] hover:text-[color:var(--color-danger)]" aria-label="Excluir pasta" title="Excluir pasta">
              <Trash2 className="h-4 w-4" />
            </button>
            <input ref={fileRef} type="file" accept={IMPORT_ACCEPT} className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void importFile(f);
            }} />
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={importing} className="gap-1.5" title="PDF, Word, Excel, CSV ou TXT — o Helpinho organiza no padrão">
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {importing ? "Analisando…" : "Importar"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => newDoc("reuniao")} className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> Nova reunião
            </Button>
            <Button size="sm" onClick={() => newDoc("roteiro")} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Novo roteiro
            </Button>
          </div>

          <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="space-y-1.5">
              {folderDocs.length === 0 ? (
                <EmptyState icon={FileText} title="Pasta vazia" description="Crie um roteiro ou o roteiro de uma reunião." />
              ) : (
                folderDocs.map((d) => (
                  <div
                    key={d.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openDoc(d)}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        openDoc(d);
                      }
                    }}
                    className={cn(
                      "group flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 outline-none transition-all focus-visible:ring-2 focus-visible:ring-blue-900",
                      draft?.id === d.id ? "border-yellow-400 bg-yellow-050" : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-050 text-blue-800">
                      {d.kind === "roteiro" ? <FileText className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-blue-900">{d.title}</span>
                      <span className="block text-[11px] text-gray-400">{KIND_LABEL[d.kind]} · {ago(d.updated_at)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDoc(d);
                      }}
                      className="shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-white hover:text-[color:var(--color-danger)] sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                      aria-label={`Excluir ${d.title}`}
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {draft ? (
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-400">{draft.id ? "Editando" : "Novo"}</span>
                  {dirty && (
                    <span className="ast-pop inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-2.5 py-1 text-[11px] font-bold text-blue-900">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-600" /> não salvo
                    </span>
                  )}
                  <span className="ml-auto" />
                  <Button size="sm" variant="ghost" onClick={closeDraft}>Fechar</Button>
                  <Button size="sm" onClick={saveDraft} disabled={saving} className="gap-1.5">
                    <Save className="h-3.5 w-3.5" /> {saving ? "Salvando…" : "Salvar"}
                  </Button>
                </div>
                {importedFrom && (
                  <div className="ast-fade-up flex items-center gap-2 rounded-2xl bg-yellow-050 px-3.5 py-2.5 text-xs text-blue-900">
                    <Sparkles className="h-4 w-4 shrink-0 text-yellow-600" />
                    <span className="min-w-0 flex-1 font-semibold">
                      {importedFrom.ai ? "Organizado pelo Helpinho" : "Texto extraído sem formatação"} a partir de &ldquo;{importedFrom.name}&rdquo;. Revise e salve.
                    </span>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                  <div>
                    <Label htmlFor="pb-title">Título</Label>
                    <Input id="pb-title" value={draft.title} onChange={(e) => edit({ title: e.target.value })} placeholder="Ex: Roteiro da 1ª reunião" style={{ fontSize: 16 }} />
                  </div>
                  <div>
                    <Label htmlFor="pb-kind">Tipo</Label>
                    <Select id="pb-kind" value={draft.kind} onChange={(e) => edit({ kind: e.target.value as ExpansionDoc["kind"] })} style={{ fontSize: 16 }}>
                      <option value="roteiro">Roteiro</option>
                      <option value="reuniao">Reunião</option>
                    </Select>
                  </div>
                </div>
                <Textarea
                  value={draft.content}
                  onChange={(e) => edit({ content: e.target.value })}
                  aria-label="Conteúdo"
                  placeholder="Escreva o roteiro, a pauta ou as anotações da reunião…"
                  className="h-[calc(100dvh-420px)] min-h-[300px] resize-y leading-relaxed"
                  style={{ fontSize: 16 }}
                />
              </div>
            ) : (
              <div className="hidden items-center justify-center rounded-2xl border border-dashed border-gray-200 p-8 text-sm text-gray-400 lg:flex">
                Abra um item ou crie um novo.
              </div>
            )}
          </div>
        </>
      )}

      <FolderDialog
        open={!!folderDialog}
        initial={folderDialog === "edit" && folder ? { name: folder.name, color: folder.color } : null}
        onClose={() => setFolderDialog(null)}
        onSubmit={submitFolder}
      />
      <ConfirmDialog
        open={!!confirmFolder}
        onClose={() => setConfirmFolder(null)}
        onConfirm={() => confirmFolder && removeFolder(confirmFolder)}
        title="Excluir pasta"
        description={`A pasta "${confirmFolder?.name}" e tudo que está dentro dela serão apagados.`}
        confirmLabel="Excluir pasta"
        danger
      />
      <ConfirmDialog
        open={!!confirmDoc}
        onClose={() => setConfirmDoc(null)}
        onConfirm={() => confirmDoc && removeDoc(confirmDoc)}
        title="Excluir item"
        description={`Excluir "${confirmDoc?.title}"?`}
        confirmLabel="Excluir"
        danger
      />
    </Card>
  );
}
