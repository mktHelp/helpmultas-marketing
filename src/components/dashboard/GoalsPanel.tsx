"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { deleteGoal } from "@/lib/services/goals";
import { computeGoalProgress, CONTENT_TYPE_LABEL } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { GoalFormModal } from "./GoalFormModal";
import type { Area, Goal, Profile, TaskStatusRow, TaskWithRelations } from "@/types/database";

function goalLabel(goal: Goal) {
  const who = goal.scope === "company" ? "Empresa" : goal.scope === "area" ? goal.area?.name || "Área" : goal.user?.full_name || "Pessoa";
  if (goal.metric === "content_published" && goal.content_type) {
    return `${who} · ${CONTENT_TYPE_LABEL[goal.content_type] || goal.content_type}`;
  }
  return who;
}

function metricLabel(goal: Goal, current: number, target: number) {
  if (goal.metric === "on_time_rate") return `${current}% de ${target}% no prazo`;
  if (goal.metric === "content_published") {
    return goal.is_recurring ? `${current} de ${target} hoje` : `${current} de ${target} publicações`;
  }
  return `${current} de ${target} tarefas`;
}

export function GoalsPanel({
  goals,
  tasks,
  statuses,
  areas,
  profiles,
  canManage,
}: {
  goals: Goal[];
  tasks: TaskWithRelations[];
  statuses: TaskStatusRow[];
  areas: Area[];
  profiles: Profile[];
  canManage: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta meta?")) return;
    try {
      await deleteGoal(supabase, id);
      toast.success("Meta excluída");
      router.refresh();
    } catch {
      toast.error("Erro ao excluir meta");
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[17px] font-semibold text-blue-900">Metas</h3>
        {canManage && (
          <button
            onClick={() => {
              setEditingGoal(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-050"
          >
            <Plus className="h-3.5 w-3.5" /> Nova meta
          </button>
        )}
      </div>

      {goals.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 py-6 text-center">
          <Target className="h-6 w-6 text-gray-300" />
          <p className="text-sm text-gray-400">Nenhuma meta ativa no momento.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {goals.map((goal) => {
            const progress = computeGoalProgress(goal, tasks, statuses);
            return (
              <div key={goal.id} className="group rounded-xl bg-gray-050 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-900">
                    {goalLabel(goal)}
                    {goal.is_recurring && (
                      <span className="rounded-full bg-blue-050 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                        DIÁRIA
                      </span>
                    )}
                  </p>
                  {canManage && (
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => {
                          setEditingGoal(goal);
                          setModalOpen(true);
                        }}
                        className="rounded p-1 text-gray-400 hover:text-blue-900"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(goal.id)}
                        className="rounded p-1 text-gray-400 hover:text-[color:var(--color-danger)]"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">{metricLabel(goal, progress.current, progress.target)}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={cn("h-full rounded-full", progress.percent >= 100 ? "bg-[color:var(--color-success)]" : "bg-yellow-500")}
                    style={{ width: `${Math.max(4, progress.percent)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <GoalFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => router.refresh()}
        areas={areas}
        profiles={profiles}
        editingGoal={editingGoal}
      />
    </Card>
  );
}
