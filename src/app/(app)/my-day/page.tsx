"use client";

import { useCallback, useEffect, useState } from "react";
import { isBefore, isToday, isAfter, parseISO } from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { TodayAnniversaries } from "@/components/shared/TodayAnniversaries";
import { TaskListItem } from "@/components/tasks/TaskListItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { listTasks } from "@/lib/services/tasks";
import { useAuth } from "@/lib/auth-context";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import type { TaskWithRelations } from "@/types/database";

export default function MyDayPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);

  const load = useCallback(() => {
    if (!profile) return;
    listTasks(supabase, { assignedTo: [profile.id] }).then(setTasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useRealtimeChanges(["tasks", "task_assignees"], load);

  const now = new Date();
  const overdue = tasks.filter((t) => t.due_date && !t.completed_at && isBefore(parseISO(t.due_date), now));
  const today = tasks.filter((t) => t.due_date && isToday(parseISO(t.due_date)) && !t.completed_at);
  const upcoming = tasks.filter((t) => t.due_date && isAfter(parseISO(t.due_date), now) && !isToday(parseISO(t.due_date)) && !t.completed_at);
  const doneToday = tasks.filter((t) => t.completed_at && isToday(parseISO(t.completed_at)));

  return (
    <div className="space-y-6">
      <PageHeader title="Meu Dia" description="Sua central pessoal de produtividade." />

      <TodayAnniversaries onlyMine />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title={`Atrasadas (${overdue.length})`}>
          {overdue.length === 0 ? <EmptyState title="Nenhuma tarefa atrasada" /> : (
            <div className="space-y-2">{overdue.map((t) => <TaskListItem key={t.id} task={t} />)}</div>
          )}
        </ChartCard>

        <ChartCard title={`Hoje (${today.length})`}>
          {today.length === 0 ? <EmptyState title="Nada para hoje" description="Aproveite para adiantar tarefas futuras." /> : (
            <div className="space-y-2">{today.map((t) => <TaskListItem key={t.id} task={t} />)}</div>
          )}
        </ChartCard>

        <ChartCard title={`Próximas (${upcoming.length})`}>
          {upcoming.length === 0 ? <EmptyState title="Sem tarefas futuras" /> : (
            <div className="space-y-2">{upcoming.slice(0, 8).map((t) => <TaskListItem key={t.id} task={t} />)}</div>
          )}
        </ChartCard>

        <ChartCard title={`Concluídas hoje (${doneToday.length})`}>
          {doneToday.length === 0 ? <EmptyState title="Nenhuma conclusão ainda" description="Vamos lá, o dia é uma oportunidade." /> : (
            <div className="space-y-2">{doneToday.map((t) => <TaskListItem key={t.id} task={t} />)}</div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
