"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Checkbox";
import { Tooltip } from "@/components/ui/Tooltip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createClient } from "@/lib/supabase/client";
import { useTaskStatuses } from "@/lib/task-status-context";
import {
  createTaskStatus, deleteTaskStatus, reorderTaskStatuses, setDefaultTaskStatus, updateTaskStatus,
} from "@/lib/services/reference";
import type { TaskStatusRow } from "@/types/database";

const COLORS = ["#243746", "#4a6a80", "#fcbf00", "#e0a900", "#375367", "#2f8f5b", "#c23b3b", "#7c8e98", "#b7c3ca"];

export function StatusesSettings() {
  const supabase = createClient();
  const { statuses, refresh } = useTaskStatuses();
  const [newLabel, setNewLabel] = useState("");
  const [toDelete, setToDelete] = useState<TaskStatusRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function add() {
    if (!newLabel.trim()) return;
    try {
      await createTaskStatus(supabase, { label: newLabel.trim() });
      setNewLabel("");
      toast.success("Etapa criada");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar etapa");
    }
  }

  async function rename(status: TaskStatusRow, label: string) {
    if (!label.trim() || label === status.label) return;
    await updateTaskStatus(supabase, status.id, { label });
    refresh();
  }

  async function recolor(status: TaskStatusRow, color: string) {
    await updateTaskStatus(supabase, status.id, { color });
    refresh();
  }

  async function toggleActive(status: TaskStatusRow) {
    await updateTaskStatus(supabase, status.id, { is_active: !status.is_active });
    toast.success(status.is_active ? "Etapa desativada" : "Etapa ativada");
    refresh();
  }

  async function makeDefault(status: TaskStatusRow) {
    await setDefaultTaskStatus(supabase, status.id);
    toast.success(`"${status.label}" agora é a etapa padrão de novas tarefas`);
    refresh();
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= statuses.length) return;
    const reordered = [...statuses];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    await reorderTaskStatuses(supabase, reordered.map((s) => s.id));
    refresh();
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteTaskStatus(supabase, toDelete);
      toast.success("Etapa excluída");
      setToDelete(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir etapa");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        Etapas definem o fluxo de produção (Kanban, filtros, tarefas). Marque uma como &ldquo;concluído&rdquo; ou
        &ldquo;cancelado&rdquo; para que ela conte corretamente nos indicadores do dashboard.
      </p>

      <div className="mb-4 flex gap-2">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Nova etapa (ex: Aguardando Cliente)"
        />
        <Button onClick={add} className="gap-1.5 shrink-0"><Plus className="h-4 w-4" /> Adicionar</Button>
      </div>

      <div className="space-y-2">
        {statuses.map((status, index) => (
          <div
            key={status.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5"
          >
            <div className="flex flex-col">
              <button onClick={() => move(index, -1)} disabled={index === 0} className="text-gray-400 hover:text-blue-900 disabled:opacity-20">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => move(index, 1)} disabled={index === statuses.length - 1} className="text-gray-400 hover:text-blue-900 disabled:opacity-20">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => recolor(status, c)}
                  className="h-5 w-5 rounded-full border-2"
                  style={{ backgroundColor: c, borderColor: status.color === c ? "#243746" : "transparent" }}
                />
              ))}
            </div>

            <input
              defaultValue={status.label}
              onBlur={(e) => rename(status, e.target.value)}
              className="min-w-[140px] flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-blue-900 hover:border-gray-200 focus:border-gray-200 focus:outline-none"
            />

            <Tooltip label={status.is_default ? "Etapa padrão de novas tarefas" : "Definir como padrão"}>
              <button
                onClick={() => !status.is_default && makeDefault(status)}
                className={status.is_default ? "text-yellow-500" : "text-gray-300 hover:text-yellow-500"}
              >
                <Star className="h-4 w-4" fill={status.is_default ? "currentColor" : "none"} />
              </button>
            </Tooltip>

            <label className="flex items-center gap-1.5 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={status.is_done}
                onChange={(e) => updateTaskStatus(supabase, status.id, { is_done: e.target.checked }).then(refresh)}
              />
              Concluído
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={status.is_cancelled}
                onChange={(e) => updateTaskStatus(supabase, status.id, { is_cancelled: e.target.checked }).then(refresh)}
              />
              Cancelado
            </label>

            <div className="ml-auto flex items-center gap-3">
              <Switch checked={status.is_active} onCheckedChange={() => toggleActive(status)} />
              <button
                onClick={() => setToDelete(status)}
                className="text-gray-400 hover:text-[color:var(--color-danger)]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        title="Excluir etapa"
        description={`Tem certeza que deseja excluir a etapa "${toDelete?.label}"? Só é possível excluir etapas sem tarefas.`}
        confirmLabel="Excluir"
        danger
        loading={deleting}
      />
    </div>
  );
}
