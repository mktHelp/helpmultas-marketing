"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { createClient } from "@/lib/supabase/client";
import { listProfiles } from "@/lib/services/profiles";
import { listTasks } from "@/lib/services/tasks";
import { teamRanking } from "@/lib/stats";
import { useTaskStatuses } from "@/lib/task-status-context";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import type { Profile, TaskWithRelations } from "@/types/database";

const ROLE_LABEL: Record<string, string> = { master: "Master", gestor: "Gestor", membro: "Membro" };

export default function TeamPage() {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const { statuses } = useTaskStatuses();

  const load = useCallback(() => {
    listProfiles(supabase).then(setProfiles);
    listTasks(supabase, {}).then(setTasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeChanges(["tasks", "task_assignees", "profiles"], load);

  const ranking = teamRanking(tasks, profiles, statuses);
  const rankingMap = new Map(ranking.map((r) => [r.profile.id, r]));

  return (
    <div>
      <PageHeader title="Equipe" description="Membros do time de Marketing e sua produtividade." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {profiles.map((p) => {
          const stats = rankingMap.get(p.id);
          return (
            <Link key={p.id} href={`/team/${p.id}`}>
              <Card className="p-5 hover:shadow-[var(--shadow-md)] transition-shadow h-full">
                <div className="flex items-center gap-3">
                  <UserAvatar name={p.full_name} avatarUrl={p.avatar_url} size="lg" />
                  <div>
                    <p className="font-display font-bold text-blue-900">{p.full_name}</p>
                    <p className="text-xs text-gray-500">{p.job_title || ROLE_LABEL[p.role]}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Badge tone="neutral">{ROLE_LABEL[p.role]}</Badge>
                  {p.department && <Badge tone="info">{p.department}</Badge>}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <Stat label="Tarefas" value={stats?.total || 0} />
                  <Stat label="Concluídas" value={stats?.completed || 0} />
                  <Stat label="Atrasadas" value={stats?.overdue || 0} />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-050 py-2">
      <p className="font-display font-bold text-blue-900">{value}</p>
      <p className="text-gray-500">{label}</p>
    </div>
  );
}
