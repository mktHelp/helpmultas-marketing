"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ArrowUpRight, PencilLine, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { StatusBadge, PriorityBadge, PRIORITY_LABELS } from "@/components/shared/StatusBadge";
import { EditableDate, EditableSelect, EditableText } from "@/components/ui/EditableCell";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { deleteTask, setTaskAssignees, updateTask } from "@/lib/services/tasks";
import { useTaskStatuses } from "@/lib/task-status-context";
import { cn, dateInputToISO, formatDate, isOverdue, isoToDateInputValue } from "@/lib/utils";
import type { Task, TaskPriority, TaskWithRelations } from "@/types/database";
import type { Profile } from "@/types/database";
import { ProjectBadge } from "./TaskFormParts";

const PRIORITY_COLORS: Record<TaskPriority, string> = { urgente: "#c23b3b", alta: "#d9822b", media: "#4a6a80", baixa: "#7c8e98" };
const PRIORITY_OPTIONS = (["urgente", "alta", "media", "baixa"] as TaskPriority[]).map((p) => ({ value: p, label: PRIORITY_LABELS[p], color: PRIORITY_COLORS[p] }));

export function TaskTable({
  tasks,
  profiles,
  onRefresh,
  canDelete,
}: {
  tasks: TaskWithRelations[];
  profiles: Profile[];
  onRefresh: () => void;
  canDelete: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const supabase = createClient();
  const { activeStatuses, byKey } = useTaskStatuses();

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((i) => i !== id) : [...s, id]));
  }

  function toggleAll() {
    setSelected(selected.length === tasks.length ? [] : tasks.map((t) => t.id));
  }

  // Edição direta na tabela: salva, avisa e recarrega a lista.
  async function save(id: string, patch: Partial<Task>, message: string) {
    try {
      await updateTask(supabase, id, patch);
      toast.success(message);
      onRefresh();
    } catch (e) {
      toast.error("Não foi possível salvar a alteração");
      throw e;
    }
  }

  async function bulkAssign(userId: string) {
    const targets = tasks.filter((t) => selected.includes(t.id));
    await Promise.all(
      targets.map((t) => {
        const ids = Array.from(new Set([...(t.assignees?.map((a) => a.id) || []), userId]));
        return setTaskAssignees(supabase, t.id, ids);
      })
    );
    toast.success(`${selected.length} tarefa(s) atualizadas`);
    setSelected([]);
    onRefresh();
  }

  async function bulkStatus(status: string) {
    await Promise.all(selected.map((id) => updateTask(supabase, id, { status })));
    toast.success(`${selected.length} tarefa(s) atualizadas`);
    setSelected([]);
    onRefresh();
  }

  async function bulkDelete() {
    await Promise.all(selected.map((id) => deleteTask(supabase, id)));
    toast.success(`${selected.length} tarefa(s) movidas para a lixeira`);
    setSelected([]);
    setConfirmDelete(false);
    onRefresh();
  }

  if (tasks.length === 0) {
    return <EmptyState title="Nenhuma tarefa encontrada" description="Ajuste os filtros ou crie uma nova tarefa." />;
  }

  return (
    <div className="ast-fade-up overflow-hidden rounded-2xl border border-gray-200/80 bg-white">
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 bg-yellow-050 px-4 py-2.5">
          <span className="text-sm font-semibold text-blue-900">{selected.length} selecionada(s)</span>
          <Select className="h-8 w-44 text-xs" onChange={(e) => bulkAssign(e.target.value)} defaultValue="">
            <option value="" disabled>Adicionar responsável</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </Select>
          <Select className="h-8 w-44 text-xs" onChange={(e) => bulkStatus(e.target.value)} defaultValue="">
            <option value="" disabled>Alterar status</option>
            {activeStatuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </Select>
          {canDelete && (
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)} className="gap-1">
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </Button>
          )}
        </div>
      )}

      <div className="divide-y divide-gray-50 sm:hidden">
        {tasks.map((task) => {
          const overdue = isOverdue(task.due_date, task.completed_at);
          return (
            <div
              key={task.id}
              className="flex items-start gap-3 border-l-4 px-4 py-3"
              style={{ borderLeftColor: byKey[task.status]?.color ?? "transparent" }}
            >
              <Checkbox checked={selected.includes(task.id)} onChange={() => toggle(task.id)} className="mt-1 shrink-0" />
              <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1">
                <p className="truncate font-semibold text-blue-900">{task.title}</p>
                {task.project && <ProjectBadge name={task.project.name} className="mt-0.5" />}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                  {task.area?.name && <span>{task.area.name}</span>}
                  <span className={cn("flex items-center gap-1 whitespace-nowrap", overdue && "font-semibold text-[color:var(--color-danger)]")}>
                    {overdue && <AlertTriangle className="h-3 w-3 shrink-0" />}
                    {formatDate(task.due_date)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={task.priority} />
                  <StatusBadge status={task.status} />
                  {task.assignees && task.assignees.length > 0 && (
                    <div className="flex items-center -space-x-1.5">
                      {task.assignees.slice(0, 3).map((a) => (
                        <UserAvatar key={a.id} name={a.full_name} avatarUrl={a.avatar_url} size="xs" className="ring-2 ring-white" />
                      ))}
                      {task.assignees.length > 3 && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-700 ring-2 ring-white">
                          +{task.assignees.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      <div className="hidden items-center justify-between gap-3 border-b border-gray-100 px-4 py-2 text-xs text-gray-500 sm:flex">
        <span>
          <b className="text-blue-900">{tasks.length}</b> tarefa{tasks.length === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-1.5">
          <PencilLine className="h-3.5 w-3.5" /> Clique em título, prioridade, status ou prazo para editar direto na tabela
        </span>
      </div>

      <div className="hidden max-h-[calc(100dvh-260px)] overflow-auto sm:block">
        <table className="erp-table">
          <thead>
            <tr>
              <th className="w-10 !pl-4">
                <Checkbox checked={selected.length === tasks.length} onChange={toggleAll} />
              </th>
              <th>Tarefa</th>
              <th>Responsável</th>
              <th>Área</th>
              <th>Prioridade</th>
              <th>Status</th>
              <th>Prazo</th>
              <th className="w-10" aria-label="Abrir" />
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const overdue = isOverdue(task.due_date, task.completed_at);
              return (
                <tr key={task.id} className={cn("group", selected.includes(task.id) && "!bg-yellow-050")}>
                  <td className="border-l-[3px] !pl-[13px]" style={{ borderLeftColor: byKey[task.status]?.color ?? "transparent" }}>
                    <Checkbox checked={selected.includes(task.id)} onChange={() => toggle(task.id)} />
                  </td>
                  <td className="min-w-[260px] max-w-[420px]">
                    <EditableText
                      value={task.title}
                      ariaLabel="título"
                      className="font-semibold text-blue-900"
                      onSave={(title) => (title ? save(task.id, { title }, "Título atualizado") : undefined)}
                    />
                    {task.project && <ProjectBadge name={task.project.name} className="mt-0.5" />}
                  </td>
                  <td>
                    {task.assignees && task.assignees.length > 0 ? (
                      <div className="flex items-center -space-x-1.5">
                        {task.assignees.slice(0, 3).map((a) => (
                          <UserAvatar key={a.id} name={a.full_name} avatarUrl={a.avatar_url} size="xs" className="ring-2 ring-white" />
                        ))}
                        {task.assignees.length > 3 && (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-700 ring-2 ring-white">
                            +{task.assignees.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">Sem responsável</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-gray-700">{task.area?.name || "-"}</td>
                  <td>
                    <EditableSelect
                      value={task.priority}
                      ariaLabel="prioridade"
                      options={PRIORITY_OPTIONS}
                      onSave={(priority) => save(task.id, { priority: priority as TaskPriority }, "Prioridade atualizada")}
                    />
                  </td>
                  <td>
                    <EditableSelect
                      value={task.status}
                      ariaLabel="status"
                      options={activeStatuses.map((st) => ({ value: st.key, label: st.label, color: st.color }))}
                      onSave={(status) => save(task.id, { status }, "Status atualizado")}
                    />
                  </td>
                  <td className={cn(overdue ? "font-semibold text-[color:var(--color-danger)]" : "text-gray-700")}>
                    <EditableDate
                      value={task.due_date ? isoToDateInputValue(task.due_date) : null}
                      ariaLabel="prazo"
                      display={() => (
                        <span className="flex items-center gap-1">
                          {overdue && <AlertTriangle className="h-3.5 w-3.5" />}
                          {formatDate(task.due_date)}
                        </span>
                      )}
                      onSave={(d) => save(task.id, { due_date: d ? dateInputToISO(d) : null }, "Prazo atualizado")}
                    />
                  </td>
                  <td className="!pr-3 text-right">
                    <Link
                      href={`/tasks/${task.id}`}
                      aria-label={`Abrir ${task.title}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 opacity-0 transition-all hover:bg-gray-100 hover:text-blue-900 focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={bulkDelete}
        title="Excluir tarefas"
        description={`${selected.length} tarefa(s) irão para a Lixeira e podem ser restauradas depois.`}
        confirmLabel="Excluir"
        danger
      />
    </div>
  );
}
