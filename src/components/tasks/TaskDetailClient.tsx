"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle, AlignLeft, Archive, ArrowLeft, CalendarClock, Check, CheckCircle2, ChevronDown, Clock, Copy, FileText,
  Flag, FolderKanban, History, ListChecks, Loader2, Megaphone, MessageSquare, Paperclip, PenLine, Shapes, SlidersHorizontal,
  Sparkles, Tag as TagIcon, Trash2, Users,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import { ChecklistPanel } from "./ChecklistPanel";
import { CommentsPanel } from "./CommentsPanel";
import { AttachmentsPanel } from "./AttachmentsPanel";
import {
  AssigneeChips, CONTENT_TYPE_OPTIONS, ContentTypeSelector, FieldLabel, PRIORITY_OPTIONS, PrioritySelector, ProjectSelector, QuickDates,
  StatusSelector, inputClass,
} from "./TaskFormParts";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  archiveTask, deleteTask, duplicateTask, getTask, listAttachments,
  listComments, listTaskActivity, setTaskAssignees, updateTask,
} from "@/lib/services/tasks";
import { listProfiles } from "@/lib/services/profiles";
import { listProjects } from "@/lib/services/projects";
import { useTaskStatuses } from "@/lib/task-status-context";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { cn, dateInputToISO, formatDate, isOverdue, isoToDateInputValue } from "@/lib/utils";
import type {
  ActivityLog, ContentType, Profile, Project, Task, TaskAttachment, TaskComment, TaskPriority, TaskWithRelations,
} from "@/types/database";

type TabKey = "detalhes" | "conteudo" | "comentarios" | "anexos" | "historico";
type SaveState = "idle" | "saving" | "saved" | "error";
type ContentField = "briefing" | "script_notes" | "caption" | "cta";

/** Mesma chave lida pelo chat do Helpinho para abrir uma conversa já com o pedido no campo. */
const HANDOFF_KEY = "hm-helpinho-handoff";

const CONTENT_FIELDS: { key: ContentField; label: string; placeholder: string; rows: number }[] = [
  { key: "briefing", label: "Briefing", placeholder: "O que esse conteúdo precisa comunicar? Público, objetivo, referências…", rows: 4 },
  { key: "script_notes", label: "Roteiro / notas de gravação", placeholder: "Roteiro, falas, cenas, observações de gravação…", rows: 6 },
  { key: "caption", label: "Legenda", placeholder: "Legenda que vai junto com a publicação…", rows: 4 },
  { key: "cta", label: "CTA (chamada para ação)", placeholder: "Ex: Chame no WhatsApp e recorra sua multa", rows: 2 },
];

export function TaskDetailClient({ taskId }: { taskId: string }) {
  const router = useRouter();
  const { profile, isManager } = useAuth();
  const { statuses, byKey, defaultStatusKey } = useTaskStatuses();
  const supabase = useMemo(() => createClient(), []);

  const [task, setTask] = useState<TaskWithRelations | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [tab, setTab] = useState<TabKey>("detalhes");
  const [propsOpen, setPropsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimer = useRef<number | null>(null);

  // Rascunhos dos campos de texto. O realtime recarrega a tarefa a cada gravação;
  // o campo que está em foco não é sobrescrito para não apagar o que se digita.
  const [titleDraft, setTitleDraft] = useState("");
  const [description, setDescription] = useState("");
  const [contentDraft, setContentDraft] = useState<Record<ContentField, string>>({ briefing: "", script_notes: "", caption: "", cta: "" });
  const focusedRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, p, pj] = await Promise.all([getTask(supabase, taskId), listProfiles(supabase), listProjects(supabase)]);
      setProjects(pj);
      setTask(t);
      setLoadError(false);
      setProfiles(p);
      if (focusedRef.current !== "title") setTitleDraft(t.title);
      if (focusedRef.current !== "description") setDescription(t.description || "");
      setContentDraft((prev) => {
        const next = { ...prev };
        for (const f of CONTENT_FIELDS) if (focusedRef.current !== f.key) next[f.key] = (t[f.key] as string | null) || "";
        return next;
      });
      const [c, a, act] = await Promise.all([
        listComments(supabase, taskId),
        listAttachments(supabase, taskId),
        listTaskActivity(supabase, taskId),
      ]);
      setComments(c);
      setAttachments(a);
      setActivity(act);
    } catch {
      setLoadError(true);
    }
  }, [supabase, taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
  }, []);

  useRealtimeChanges(
    ["tasks", "task_comments", "task_checklists", "task_assignees", "task_attachments"],
    load,
    {
      filters: {
        tasks: `id=eq.${taskId}`,
        task_comments: `task_id=eq.${taskId}`,
        task_checklists: `task_id=eq.${taskId}`,
        task_assignees: `task_id=eq.${taskId}`,
        task_attachments: `task_id=eq.${taskId}`,
      },
    }
  );

  if (loadError && !task) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm text-gray-500">Não foi possível carregar a tarefa. Ela pode ter sido excluída ou você não tem acesso.</p>
        <Link href="/tasks" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-blue-050 px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-100">
          <ArrowLeft className="h-4 w-4" /> Voltar para tarefas
        </Link>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="mx-auto max-w-6xl space-y-4" role="status" aria-label="Carregando tarefa">
        <div className="ast-skeleton h-40 rounded-3xl" />
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="ast-skeleton h-72 rounded-3xl" />
          <div className="ast-skeleton h-96 rounded-3xl" />
        </div>
      </div>
    );
  }

  const canEdit = isManager || !!task.assignees?.some((a) => a.id === profile?.id) || task.created_by === profile?.id;
  const status = byKey[task.status];
  const statusColor = status?.color ?? "#7c8e98";
  const done = !!status?.is_done;
  const overdue = isOverdue(task.due_date, task.completed_at);
  const priority = PRIORITY_OPTIONS.find((p) => p.value === task.priority);
  const contentType = CONTENT_TYPE_OPTIONS.find((c) => c.value === task.content_type);
  const checklist = task.checklists || [];
  const checklistDone = checklist.filter((c) => c.completed).length;

  function markSaved() {
    setSaveState("saved");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => setSaveState("idle"), 2200);
  }

  async function patch(fields: Partial<Task>) {
    if (!task) return;
    setSaveState("saving");
    try {
      const updated = await updateTask(supabase, task.id, fields);
      setTask((prev) => (prev ? { ...prev, ...updated } : prev));
      markSaved();
    } catch {
      setSaveState("error");
      toast.error("Não foi possível salvar a alteração");
      void load();
    }
  }

  async function handleAssigneesChange(ids: string[]) {
    if (!task) return;
    setSaveState("saving");
    try {
      await setTaskAssignees(supabase, task.id, ids);
      setTask((prev) => (prev ? { ...prev, assignees: profiles.filter((p) => ids.includes(p.id)) } : prev));
      markSaved();
    } catch {
      setSaveState("error");
      toast.error("Não foi possível atualizar os responsáveis");
      void load();
    }
  }

  async function handleDuplicate() {
    if (!profile || !task) return;
    try {
      const copy = await duplicateTask(supabase, task, profile.id, defaultStatusKey);
      toast.success("Tarefa duplicada");
      router.push(`/tasks/${copy.id}`);
    } catch {
      toast.error("Não foi possível duplicar a tarefa");
    }
  }

  async function handleArchive() {
    if (!task) return;
    try {
      await archiveTask(supabase, task.id, !task.is_archived);
      toast.success(task.is_archived ? "Tarefa restaurada" : "Tarefa arquivada");
      void load();
    } catch {
      toast.error("Não foi possível arquivar a tarefa");
    }
  }

  async function handleDelete() {
    if (!task) return;
    try {
      await deleteTask(supabase, task.id);
      toast.success("Tarefa movida para a lixeira");
      router.push("/tasks");
    } catch {
      toast.error("Não foi possível excluir a tarefa");
    }
  }

  function askHelpinho() {
    if (!task) return;
    const prompt = `Quero ajuda com o conteúdo da tarefa "${task.title}" (id: ${task.id}). Sugira briefing, roteiro, legenda e CTA no meu estilo e, se eu aprovar, salve na tarefa.`;
    try {
      window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ prompt }));
    } catch {
      // sem sessionStorage: abre o chat sem o texto pronto
    }
    router.push("/assistente");
  }

  const tabs: { key: TabKey; label: string; icon: typeof FileText; count?: number }[] = [
    { key: "detalhes", label: "Detalhes", icon: AlignLeft },
    { key: "conteudo", label: "Conteúdo", icon: PenLine },
    { key: "comentarios", label: "Comentários", icon: MessageSquare, count: comments.length },
    { key: "anexos", label: "Anexos", icon: Paperclip, count: attachments.length },
    { key: "historico", label: "Histórico", icon: History },
  ];

  const dueValue = isoToDateInputValue(task.due_date);
  const estimated = task.estimated_minutes ?? 0;
  const actual = task.actual_minutes ?? 0;
  const timePercent = estimated > 0 ? Math.min(100, Math.round((actual / estimated) * 100)) : 0;
  const overTime = estimated > 0 && actual > estimated;

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/tasks" className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-gray-500 transition-colors hover:bg-blue-050 hover:text-blue-900">
        <ArrowLeft className="h-4 w-4" /> Tarefas
      </Link>

      {/* ---------------- Cabeçalho ---------------- */}
      <div className="ast-fade-up overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[var(--shadow-sm)]">
        <div className="h-2 transition-colors duration-500" style={{ backgroundColor: statusColor }} aria-hidden />
        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start gap-3">
            {canEdit ? (
              <textarea
                rows={1}
                value={titleDraft}
                onChange={(e) => {
                  setTitleDraft(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onFocus={() => (focusedRef.current = "title")}
                onBlur={() => {
                  focusedRef.current = null;
                  const next = titleDraft.trim();
                  if (!next) setTitleDraft(task.title);
                  else if (next !== task.title) void patch({ title: next });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLTextAreaElement).blur();
                  }
                }}
                ref={(el) => {
                  if (el) {
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }
                }}
                aria-label="Título da tarefa"
                className="min-w-0 flex-1 basis-64 resize-none rounded-xl border-0 bg-transparent px-2 py-1 font-display text-2xl font-bold leading-tight text-blue-900 outline-none transition-colors hover:bg-gray-050 focus:bg-gray-050 focus:ring-2 focus:ring-yellow-500"
              />
            ) : (
              <h1 className="min-w-0 flex-1 basis-64 px-2 font-display text-2xl font-bold leading-tight text-blue-900">{task.title}</h1>
            )}

            <div className="flex shrink-0 items-center gap-1.5">
              <span
                className={cn(
                  "mr-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition-all",
                  saveState === "idle" && "opacity-0",
                  saveState === "saving" && "bg-gray-100 text-gray-500",
                  saveState === "saved" && "bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]",
                  saveState === "error" && "bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]"
                )}
                role="status"
                aria-live="polite"
              >
                {saveState === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
                {saveState === "saved" && <Check className="ast-pop h-3 w-3" strokeWidth={3} />}
                {saveState === "saving" ? "Salvando…" : saveState === "saved" ? "Salvo" : saveState === "error" ? "Erro ao salvar" : ""}
              </span>
              <button type="button" onClick={handleDuplicate} title="Duplicar tarefa" aria-label="Duplicar tarefa" className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-blue-050 hover:text-blue-900">
                <Copy className="h-4 w-4" /> <span className="hidden sm:inline">Duplicar</span>
              </button>
              <button type="button" onClick={handleArchive} title={task.is_archived ? "Restaurar" : "Arquivar"} aria-label={task.is_archived ? "Restaurar tarefa" : "Arquivar tarefa"} className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-blue-050 hover:text-blue-900">
                <Archive className="h-4 w-4" /> <span className="hidden sm:inline">{task.is_archived ? "Restaurar" : "Arquivar"}</span>
              </button>
              {isManager && (
                <button type="button" onClick={() => setConfirmDelete(true)} title="Excluir tarefa" aria-label="Excluir tarefa" className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-[color:var(--color-danger)] transition-colors hover:bg-[color:var(--color-danger-bg)]">
                  <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Excluir</span>
                </button>
              )}
            </div>
          </div>

          {/* Resumo em pílulas */}
          <div className="mt-3 flex flex-wrap items-center gap-2 px-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white shadow-sm" style={{ backgroundColor: statusColor }}>
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-white/80" />}
              {status?.label ?? task.status}
            </span>
            {priority && (
              <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: `${priority.color}66`, color: priority.color, backgroundColor: `${priority.color}14` }}>
                <Flag className="h-3 w-3" /> {priority.label}
              </span>
            )}
            {task.due_date && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
                  overdue ? "bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]" : done ? "bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]" : "bg-blue-050 text-blue-800"
                )}
              >
                {overdue ? <AlertTriangle className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}
                {overdue ? "Atrasada · " : ""}
                {formatDate(task.due_date)}
              </span>
            )}
            {contentType && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
                <contentType.icon className="h-3 w-3" /> {contentType.label}
              </span>
            )}
            {task.area && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: task.area.color || "#4a6a80" }}>
                {task.area.name}
              </span>
            )}
            {task.project && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                <FolderKanban className="h-3 w-3" /> {task.project.name}
              </span>
            )}
            {task.campaign && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                <Megaphone className="h-3 w-3" /> {task.campaign.name}
              </span>
            )}
            {task.is_archived && <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700">Arquivada</span>}
            {task.assignees && task.assignees.length > 0 && (
              <span className="ml-auto flex items-center -space-x-1.5">
                {task.assignees.slice(0, 5).map((a) => (
                  <UserAvatar key={a.id} name={a.full_name} avatarUrl={a.avatar_url} size="xs" className="ring-2 ring-white" />
                ))}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ---------------- Conteúdo principal ---------------- */}
        <div className="min-w-0">
          <div className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1.5 shadow-[var(--shadow-sm)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 sm:flex-1 sm:justify-center",
                    active ? "bg-blue-900 text-white shadow-md" : "text-gray-600 hover:bg-gray-050"
                  )}
                >
                  <Icon className={cn("h-4 w-4", active && "text-yellow-400")} />
                  {t.label}
                  {t.count !== undefined && t.count > 0 && (
                    <span className={cn("rounded-full px-1.5 text-[11px] font-bold", active ? "bg-white/20" : "bg-gray-200 text-gray-700")}>{t.count}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div key={tab} className="ast-fade-up space-y-4">
            {tab === "detalhes" && (
              <>
                <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-[var(--shadow-sm)] sm:p-5">
                  <h3 className="mb-2.5 flex items-center gap-2 font-display text-sm font-bold text-blue-900">
                    <AlignLeft className="h-4 w-4 text-blue-700" /> Descrição
                  </h3>
                  <textarea
                    rows={5}
                    value={description}
                    disabled={!canEdit}
                    onChange={(e) => setDescription(e.target.value)}
                    onFocus={() => (focusedRef.current = "description")}
                    onBlur={() => {
                      focusedRef.current = null;
                      if (description !== (task.description || "")) void patch({ description: description.trim() ? description : null });
                    }}
                    placeholder={canEdit ? "Adicione detalhes, links e referências…" : "Sem descrição."}
                    className="w-full resize-y rounded-2xl border border-gray-200 bg-gray-050/60 px-3.5 py-3 text-blue-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-900 focus:bg-white focus:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ fontSize: 16 }}
                  />
                </section>

                <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-[var(--shadow-sm)] sm:p-5">
                  <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-blue-900">
                    <ListChecks className="h-4 w-4 text-blue-700" /> Checklist
                    {checklist.length > 0 && (
                      <span className="rounded-full bg-gray-100 px-2 text-[11px] font-bold text-gray-600">{checklistDone}/{checklist.length}</span>
                    )}
                  </h3>
                  <ChecklistPanel
                    taskId={task.id}
                    items={checklist}
                    disabled={!canEdit}
                    onChange={(items) => setTask((prev) => (prev ? { ...prev, checklists: items } : prev))}
                  />
                </section>
              </>
            )}

            {tab === "conteudo" && (
              <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-[var(--shadow-sm)] sm:p-5">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="flex items-center gap-2 font-display text-sm font-bold text-blue-900">
                      <PenLine className="h-4 w-4 text-blue-700" /> Conteúdo da publicação
                    </h3>
                    <p className="text-xs text-gray-500">Briefing, roteiro, legenda e CTA. O Helpinho também escreve aqui.</p>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={askHelpinho}
                      className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500 px-4 py-2.5 font-display text-sm font-semibold text-blue-900 shadow-sm transition-all hover:bg-yellow-600 active:scale-95"
                    >
                      <Sparkles className="h-4 w-4" /> Pedir ao Helpinho
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {CONTENT_FIELDS.map((f) => (
                    <div key={f.key}>
                      <FieldLabel htmlFor={`c-${f.key}`}>{f.label}</FieldLabel>
                      <textarea
                        id={`c-${f.key}`}
                        rows={f.rows}
                        value={contentDraft[f.key]}
                        disabled={!canEdit}
                        onChange={(e) => setContentDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                        onFocus={() => (focusedRef.current = f.key)}
                        onBlur={() => {
                          focusedRef.current = null;
                          const current = (task[f.key] as string | null) || "";
                          if (contentDraft[f.key] !== current) void patch({ [f.key]: contentDraft[f.key].trim() ? contentDraft[f.key] : null } as Partial<Task>);
                        }}
                        placeholder={f.placeholder}
                        className="w-full resize-y rounded-2xl border border-gray-200 bg-gray-050/60 px-3.5 py-3 text-blue-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-900 focus:bg-white focus:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:opacity-70"
                        style={{ fontSize: 16 }}
                      />
                    </div>
                  ))}

                  <div className="max-w-xs">
                    <FieldLabel icon={CalendarClock} htmlFor="publish">Publicar em</FieldLabel>
                    <input
                      id="publish"
                      type="date"
                      disabled={!canEdit}
                      value={isoToDateInputValue(task.publish_at)}
                      onChange={(e) => void patch({ publish_at: e.target.value ? dateInputToISO(e.target.value) : null })}
                      className={inputClass}
                      style={{ fontSize: 16 }}
                    />
                  </div>
                </div>
              </section>
            )}

            {tab === "comentarios" && (
              <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-[var(--shadow-sm)] sm:p-5">
                <CommentsPanel taskId={task.id} comments={comments} onChange={setComments} />
              </section>
            )}

            {tab === "anexos" && (
              <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-[var(--shadow-sm)] sm:p-5">
                <AttachmentsPanel taskId={task.id} attachments={attachments} onChange={setAttachments} />
              </section>
            )}

            {tab === "historico" && (
              <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-[var(--shadow-sm)] sm:p-5">
                <ActivityTimeline logs={activity} />
              </section>
            )}
          </div>
        </div>

        {/* ---------------- Propriedades ---------------- */}
        <aside className="lg:sticky lg:top-0 lg:self-start">
          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[var(--shadow-sm)]">
            <button
              type="button"
              onClick={() => setPropsOpen((v) => !v)}
              aria-expanded={propsOpen}
              className="flex w-full items-center gap-2 border-b border-gray-100 px-4 py-3.5 text-left lg:cursor-default"
            >
              <SlidersHorizontal className="h-4 w-4 text-blue-700" />
              <span className="flex-1 font-display text-sm font-bold text-blue-900">Propriedades</span>
              <span className="text-xs text-gray-400 lg:hidden">{status?.label} · {priority?.label}</span>
              <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform duration-300 lg:hidden", propsOpen && "rotate-180")} />
            </button>

            <div className={cn("space-y-5 px-4 py-4", propsOpen ? "block" : "hidden", "lg:block")}>
              <div>
                <FieldLabel>Etapa</FieldLabel>
                <StatusSelector statuses={statuses.filter((s) => s.is_active || s.key === task.status)} value={task.status} disabled={!canEdit} onChange={(key) => void patch({ status: key })} />
              </div>

              <div>
                <FieldLabel icon={Flag}>Prioridade</FieldLabel>
                <PrioritySelector compact value={task.priority} disabled={!canEdit} onChange={(v: TaskPriority) => void patch({ priority: v })} />
              </div>

              <div>
                <FieldLabel icon={Users}>Responsáveis</FieldLabel>
                <AssigneeChips
                  profiles={profiles}
                  selectedIds={task.assignees?.map((a) => a.id) || []}
                  onChange={handleAssigneesChange}
                  disabled={!isManager}
                />
                {!isManager && <p className="mt-1.5 text-[11px] text-gray-400">Só gestores alteram os responsáveis.</p>}
              </div>

              <div>
                <FieldLabel icon={CalendarClock} htmlFor="due-date">Prazo</FieldLabel>
                <input
                  id="due-date"
                  type="date"
                  disabled={!canEdit}
                  value={dueValue}
                  onChange={(e) => void patch({ due_date: e.target.value ? dateInputToISO(e.target.value) : null })}
                  className={inputClass}
                  style={{ fontSize: 16 }}
                />
                {canEdit && <QuickDates value={dueValue} onChange={(v) => void patch({ due_date: v ? dateInputToISO(v) : null })} />}
              </div>

              <div>
                <FieldLabel icon={Shapes}>Tipo de conteúdo</FieldLabel>
                <ContentTypeSelector
                  value={task.content_type}
                  disabled={!canEdit}
                  onChange={(v) => void patch({ content_type: (v || null) as ContentType | null })}
                />
              </div>

              <div>
                <FieldLabel icon={FolderKanban}>Projeto</FieldLabel>
                <ProjectSelector
                  projects={projects}
                  value={task.project_id}
                  disabled={!canEdit}
                  onChange={(id) => {
                    const pr = projects.find((x) => x.id === id) ?? null;
                    setTask((prev) => (prev ? { ...prev, project_id: id || null, project: pr } : prev));
                    void patch({ project_id: id || null });
                  }}
                />
              </div>

              <div>
                <FieldLabel icon={Clock}>Tempo (minutos)</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-gray-500">Estimado</span>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      disabled={!canEdit}
                      key={`est-${task.estimated_minutes ?? ""}`}
                      defaultValue={task.estimated_minutes ?? ""}
                      onBlur={(e) => {
                        const next = e.target.value ? Number(e.target.value) : null;
                        if (next !== task.estimated_minutes) void patch({ estimated_minutes: next });
                      }}
                      className={inputClass}
                      style={{ fontSize: 16 }}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-gray-500">Real</span>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      disabled={!canEdit}
                      key={`act-${task.actual_minutes ?? ""}`}
                      defaultValue={task.actual_minutes ?? ""}
                      onBlur={(e) => {
                        const next = e.target.value ? Number(e.target.value) : null;
                        if (next !== task.actual_minutes) void patch({ actual_minutes: next });
                      }}
                      className={inputClass}
                      style={{ fontSize: 16 }}
                    />
                  </label>
                </div>
                {estimated > 0 && (
                  <div className="mt-2.5">
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={cn("h-2 rounded-full transition-all duration-500", overTime ? "bg-[color:var(--color-danger)]" : "bg-gradient-to-r from-yellow-500 to-amber-400")}
                        style={{ width: `${timePercent}%` }}
                      />
                    </div>
                    <p className={cn("mt-1 text-[11px] font-semibold", overTime ? "text-[color:var(--color-danger)]" : "text-gray-500")}>
                      {actual} de {estimated} min{overTime ? ` · ${actual - estimated} min a mais que o previsto` : ""}
                    </p>
                  </div>
                )}
              </div>

              {task.tags && task.tags.length > 0 && (
                <div>
                  <FieldLabel icon={TagIcon}>Tags</FieldLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {task.tags.map((t) => (
                      <span key={t.id} className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: `${t.color}1a`, color: t.color }}>
                        #{t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-gray-100 pt-4 text-xs text-gray-400">
                {task.creator && (
                  <span className="flex items-center gap-1.5">
                    Criada por <UserAvatar name={task.creator.full_name} avatarUrl={task.creator.avatar_url} size="xs" />
                    <span className="font-semibold text-gray-500">{task.creator.full_name}</span>
                  </span>
                )}
                <span>em {formatDate(task.created_at)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Excluir tarefa"
        description="A tarefa vai para a Lixeira e pode ser restaurada depois no menu Lixeira."
        confirmLabel="Excluir"
        danger
      />
    </div>
  );
}
