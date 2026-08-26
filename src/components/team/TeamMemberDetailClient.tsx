"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { TaskListItem } from "@/components/tasks/TaskListItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { getProfile } from "@/lib/services/profiles";
import { listTasks } from "@/lib/services/tasks";
import { teamRanking } from "@/lib/stats";
import { useTaskStatuses } from "@/lib/task-status-context";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import type { Profile, TaskWithRelations } from "@/types/database";

const ROLE_LABEL: Record<string, string> = { master: "Master", gestor: "Gestor", membro: "Membro" };

export function TeamMemberDetailClient({ userId }: { userId: string }) {
  const supabase = createClient();
  const { statuses, byKey } = useTaskStatuses();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);

  const load = useCallback(() => {
    getProfile(supabase, userId).then(setProfile);
    listTasks(supabase, { assignedTo: [userId] }).then(setTasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useRealtimeChanges(["tasks", "task_assignees"], load);

  if (!profile) return <div className="py-16 text-center text-sm text-gray-400">Carregando...</div>;

  const [stats] = teamRanking(tasks, [profile], statuses);
  const pending = tasks.filter((t) => !byKey[t.status]?.is_done && !byKey[t.status]?.is_cancelled);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/team" className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-blue-900">
        <ArrowLeft className="h-4 w-4" /> Voltar para equipe
      </Link>

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <UserAvatar name={profile.full_name} avatarUrl={profile.avatar_url} size="lg" />
          <div>
            <h1 className="font-display text-xl font-bold text-blue-900">{profile.full_name}</h1>
            <p className="text-sm text-gray-500">{profile.job_title}</p>
            <div className="mt-1 flex gap-2">
              <Badge tone="neutral">{ROLE_LABEL[profile.role]}</Badge>
              {profile.department && <Badge tone="info">{profile.department}</Badge>}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Total de tarefas" value={stats?.total || 0} />
          <Stat label="Concluídas" value={stats?.completed || 0} />
          <Stat label="Atrasadas" value={stats?.overdue || 0} />
          <Stat label="Taxa de conclusão" value={`${stats?.completionRate || 0}%`} />
        </div>
      </Card>

      <h3 className="mb-3 mt-6 font-display text-base font-bold text-blue-900">Tarefas em aberto</h3>
      {pending.length === 0 ? (
        <EmptyState title="Sem tarefas em aberto" />
      ) : (
        <div className="space-y-2">{pending.map((t) => <TaskListItem key={t.id} task={t} />)}</div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-gray-050 p-3 text-center">
      <p className="font-display text-lg font-bold text-blue-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
