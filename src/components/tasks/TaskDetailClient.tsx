"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Copy, Archive, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { ChecklistPanel } from "./ChecklistPanel";
import { CommentsPanel } from "./CommentsPanel";
import { AttachmentsPanel } from "./AttachmentsPanel";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  archiveTask, deleteTask, duplicateTask, getTask, listAttachments,
  listComments, listTaskActivity, updateTask,
} from "@/lib/services/tasks";
import { listProfiles } from "@/lib/services/profiles";
import { useTaskStatuses } from "@/lib/task-status-context";
import { formatDate } from "@/lib/utils";
import type { ActivityLog, Profile, TaskAttachment, TaskComment, TaskWithRelations } from "@/types/database";

export function TaskDetailClient({ taskId }: { taskId: string }) {
  const router = useRouter();
  const { profile, isManager } = useAuth();
  const { statuses, defaultStatusKey } = useTaskStatuses();
  const supabase = createClient();

  const [task, setTask] = useState<TaskWithRelations | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [tab, setTab] = useState("detalhes");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [description, setDescription] = useState("");

  async function load() {
    const [t, p] = await Promise.all([getTask(supabase, taskId), listProfiles(supabase)]);
    setTask(t);
    setDescription(t.description || "");
    setProfiles(p);
    const [c, a, act] = await Promise.all([
      listComments(supabase, taskId),
      listAttachments(supabase, taskId),
      listTaskActivity(supabase, taskId),
    ]);
    setComments(c);
    setAttachments(a);
    setActivity(act);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  if (!task) return <div className="py-16 text-center text-sm text-gray-400">Carregando tarefa...</div>;

  const canEdit = isManager || task.assigned_to === profile?.id || task.created_by === profile?.id;

  async function patch(fields: Partial<TaskWithRelations>) {
    if (!task) return;
    const updated = await updateTask(supabase, task.id, fields);
    setTask({ ...task, ...updated });
  }

  async function handleDuplicate() {
    if (!profile || !task) return;
    const copy = await duplicateTask(supabase, task, profile.id, defaultStatusKey);
    toast.success("Tarefa duplicada");
    router.push(`/tasks/${copy.id}`);
  }

  async function handleArchive() {
    if (!task) return;
    await archiveTask(supabase, task.id, !task.is_archived);
    toast.success(task.is_archived ? "Tarefa restaurada" : "Tarefa arquivada");
    load();
  }

  async function handleDelete() {
    if (!task) return;
    await deleteTask(supabase, task.id);
    toast.success("Tarefa excluída");
    router.push("/tasks");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/tasks" className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-blue-900">
        <ArrowLeft className="h-4 w-4" /> Voltar para tarefas
      </Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {canEdit ? (
            <input
              defaultValue={task.title}
              onBlur={(e) => e.target.value !== task.title && patch({ title: e.target.value })}
              className="min-w-0 flex-1 border-none bg-transparent font-display text-xl font-bold text-blue-900 focus:outline-none focus:ring-0"
            />
          ) : (
            <h1 className="font-display text-xl font-bold text-blue-900">{task.title}</h1>
          )}
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={handleDuplicate} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" /> Duplicar
            </Button>
            <Button size="sm" variant="ghost" onClick={handleArchive} className="gap-1.5">
              <Archive className="h-3.5 w-3.5" /> {task.is_archived ? "Restaurar" : "Arquivar"}
            </Button>
            {isManager && (
              <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)} className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Status">
            <Select value={task.status} disabled={!canEdit} onChange={(e) => patch({ status: e.target.value })}>
              {statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Prioridade">
            <Select value={task.priority} disabled={!canEdit} onChange={(e) => patch({ priority: e.target.value as TaskWithRelations["priority"] })}>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </Select>
          </Field>
          <Field label="Responsável">
            <Select value={task.assigned_to || ""} disabled={!isManager} onChange={(e) => patch({ assigned_to: e.target.value || null })}>
              <option value="">Sem responsável</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </Select>
          </Field>
          <Field label="Prazo">
            <input
              type="date"
              disabled={!canEdit}
              defaultValue={task.due_date ? task.due_date.slice(0, 10) : ""}
              onChange={(e) => patch({ due_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
              className="h-10 w-full rounded-[14px] border border-gray-200 bg-white px-3.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </Field>
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
          {task.creator && (
            <span className="flex items-center gap-1.5">
              Criado por <UserAvatar name={task.creator.full_name} avatarUrl={task.creator.avatar_url} size="xs" /> {task.creator.full_name}
            </span>
          )}
          <span>em {formatDate(task.created_at)}</span>
        </div>
      </Card>

      <div className="my-5">
        <Tabs
          tabs={[
            { key: "detalhes", label: "Detalhes" },
            { key: "comentarios", label: "Comentários", count: comments.length },
            { key: "anexos", label: "Anexos", count: attachments.length },
            { key: "historico", label: "Histórico" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "detalhes" && (
        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="mb-2 font-display text-sm font-bold text-blue-900">Descrição</h3>
            <Textarea
              rows={4}
              value={description}
              disabled={!canEdit}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== task.description && patch({ description })}
            />
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 font-display text-sm font-bold text-blue-900">Checklist</h3>
            <ChecklistPanel taskId={task.id} items={task.checklists || []} onChange={(items) => setTask({ ...task, checklists: items })} />
          </Card>
        </div>
      )}

      {tab === "comentarios" && (
        <Card className="p-5">
          <CommentsPanel taskId={task.id} comments={comments} onChange={setComments} />
        </Card>
      )}

      {tab === "anexos" && (
        <Card className="p-5">
          <AttachmentsPanel taskId={task.id} attachments={attachments} onChange={setAttachments} />
        </Card>
      )}

      {tab === "historico" && (
        <Card className="p-5">
          <ActivityTimeline logs={activity} />
        </Card>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Excluir tarefa"
        description="Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        danger
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-bold text-gray-700">{label}</p>
      {children}
    </div>
  );
}
