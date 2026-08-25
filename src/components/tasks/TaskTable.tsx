"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { StatusBadge, PriorityBadge } from "@/components/shared/StatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { deleteTask, setTaskAssignees, updateTask } from "@/lib/services/tasks";
import { useTaskStatuses } from "@/lib/task-status-context";
import { cn, formatDate, isOverdue } from "@/lib/utils";
import type { TaskWithRelations } from "@/types/database";
import type { Profile } from "@/types/database";

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
  const { activeStatuses } = useTaskStatuses();

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((i) => i !== id) : [...s, id]));
  }

  function toggleAll() {
    setSelected(selected.length === tasks.length ? [] : tasks.map((t) => t.id));
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
    <div className="rounded-2xl border border-gray-200 bg-white">
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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-bold uppercase text-gray-500">
              <th className="w-10 py-3 pl-4">
                <Checkbox checked={selected.length === tasks.length} onChange={toggleAll} />
              </th>
              <th className="py-3 pr-3">Tarefa</th>
              <th className="py-3 pr-3">Responsável</th>
              <th className="py-3 pr-3">Área</th>
              <th className="py-3 pr-3">Prioridade</th>
              <th className="py-3 pr-3">Status</th>
              <th className="py-3 pr-4">Prazo</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const overdue = isOverdue(task.due_date, task.completed_at);
              return (
                <tr key={task.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-050/60">
                  <td className="py-3 pl-4">
                    <Checkbox checked={selected.includes(task.id)} onChange={() => toggle(task.id)} />
                  </td>
                  <td className="py-3 pr-3">
                    <Link href={`/tasks/${task.id}`} className="font-semibold text-blue-900 hover:underline">
                      {task.title}
                    </Link>
                    {task.project && <p className="text-xs text-gray-400">{task.project.name}</p>}
                  </td>
                  <td className="py-3 pr-3">
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
                  <td className="py-3 pr-3 text-gray-700">{task.area?.name || "-"}</td>
                  <td className="py-3 pr-3"><PriorityBadge priority={task.priority} /></td>
                  <td className="py-3 pr-3"><StatusBadge status={task.status} /></td>
                  <td className={cn("py-3 pr-4", overdue ? "font-semibold text-[color:var(--color-danger)]" : "text-gray-700")}>
                    <span className="flex items-center gap-1">
                      {overdue && <AlertTriangle className="h-3.5 w-3.5" />}
                      {formatDate(task.due_date)}
                    </span>
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
