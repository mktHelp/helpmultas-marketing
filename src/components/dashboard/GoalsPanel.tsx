"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { deleteGoal } from "@/lib/services/goals";
import { computeGoalProgress, CONTENT_TYPE_LABEL } from "@/lib/stats";
import { GoalFormModal } from "./GoalFormModal";
import type { Area, Goal, Profile, TaskStatusRow, TaskWithRelations } from "@/types/database";

function goalLabel(goal: Goal) {
  const who = goal.scope === "company" ? "Empresa" : goal.scope === "area" ? goal.area?.name || "Área" : goal.user?.full_name || "Pessoa";
  if (goal.metric === "content_published" && goal.content_type) {
    return `${who} · ${CONTENT_TYPE_LABEL[goal.content_type] || goal.content_type}`;
  }
  return who;
}

function goalDisplay(goal: Goal, target: number) {
  if (goal.metric === "on_time_rate") {
    return { big: `${target}%`, unit: "no prazo" };
  }
  if (goal.metric === "content_published") {
    return { big: `${target}`, unit: goal.is_recurring ? "por dia" : "publicações" };
  }
  return { big: `${target}`, unit: "tarefas" };
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
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {goals.map((goal) => {
            const progress = computeGoalProgress(goal, tasks, statuses);
            const display = goalDisplay(goal, progress.target);
            return (
              <div
                key={goal.id}
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-500 p-4 shadow-lg shadow-yellow-500/25 transition-transform hover:scale-[1.02]"
              >
                <Target
                  className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 text-blue-900/10"
                  strokeWidth={1.5}
                />

                <div className="relative flex items-start justify-between gap-2">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-blue-900">
                    {goalLabel(goal)}
                    {goal.is_recurring && (
                      <span className="rounded-full bg-blue-900/15 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-900">
                        DIÁRIA
                      </span>
                    )}
                  </p>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => {
                          setEditingGoal(goal);
                          setModalOpen(true);
                        }}
                        className="rounded p-1 text-blue-900/60 hover:bg-white/30 hover:text-blue-900"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(goal.id)}
                        className="rounded p-1 text-blue-900/60 hover:bg-white/30 hover:text-[color:var(--color-danger)]"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative mt-3">
                  <span className="font-display text-4xl font-extrabold leading-none text-blue-900">
                    {display.big}
                  </span>
                </div>
                <p className="relative mt-1 text-xs font-extrabold uppercase tracking-wide text-blue-900/70">
                  {display.unit}
                </p>
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
