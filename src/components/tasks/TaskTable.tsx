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
import { deleteTask, updateTask } from "@/lib/services/tasks";
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

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((i) => i !== id) : [...s, id]));
  }

  function toggleAll() {
    setSelected(selected.length === tasks.length ? [] : tasks.map((t) => t.id));
  }

  async function bulkAssign(userId: string) {
    await Promise.all(selected.map((id) => updateTask(supabase, id, { assigned_to: userId || null })));
    toast.success(`${selected.length} tarefa(s) atualizadas`);
    setSelected([]);
    onRefresh();
  }

  async function bulkStatus(status: string) {
    await Promise.all(selected.map((id) => updateTask(supabase, id, { status: status as TaskWithRelations["status"] })));
    toast.success(`${selected.length} tarefa(s) atualizadas`);
    setSelected([]);
    onRefresh();
  }

  async function bulkDelete() {
    await Promise.all(selected.map((id) => deleteTask(supabase, id)));
    toast.success(`${selected.length} tarefa(s) excluídas`);
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
            <option value="" disabled>Alterar responsável</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </Select>
          <Select className="h-8 w-44 text-xs" onChange={(e) => bulkStatus(e.target.value)} defaultValue="">
            <option value="" disabled>Alterar status</option>
            <option value="backlog">Backlog</option>
            <option value="em_producao">Em Produção</option>
            <option value="em_revisao">Em Revisão</option>
            <option value="aprovado">Aprovado</option>
            <option value="concluido">Concluído</option>
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
                    {task.assignee ? (
                      <div className="flex items-center gap-2">
                        <UserAvatar name={task.assignee.full_name} avatarUrl={task.assignee.avatar_url} size="xs" />
                        <span className="text-gray-700">{task.assignee.full_name}</span>
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
        description={`Tem certeza que deseja excluir ${selected.length} tarefa(s)? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
      />
    </div>
  );
}
