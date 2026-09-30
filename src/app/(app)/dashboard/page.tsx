import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refreshFollowerSnapshotsIfStale } from "@/lib/instagram-api";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";
import { listTasks } from "@/lib/services/tasks";
import { listAreas, listTaskStatuses } from "@/lib/services/reference";
import { listProfiles } from "@/lib/services/profiles";
import { timeByContentType, socialFollowerDeltas } from "@/lib/stats";
import { GoalsPanel } from "@/components/dashboard/GoalsPanel";
import { TimeManagementCard } from "@/components/dashboard/TimeManagementCard";
import { SocialFollowersCard } from "@/components/dashboard/SocialFollowersCard";
import { HomeDashboard } from "@/components/dashboard/HomeDashboard";
import { listGoals } from "@/lib/services/goals";
import { listSocialAccounts, listRecentFollowerSnapshots, listRecentLinkClicks } from "@/lib/services/social";
import { listInstagramAudience, listInstagramInsights } from "@/lib/services/instagram";
import { loadTrafficDaily } from "@/lib/services/meta-ads";
import { TaskListItem } from "@/components/tasks/TaskListItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { RealtimeRefresher } from "@/components/shared/RealtimeRefresher";
import { toDateKey } from "@/lib/utils";
import type { SlimTask } from "@/lib/home-analytics";

export default async function DashboardPage() {
  // Mantém o card de seguidores fresco direto da API do Instagram (antes era
  // o n8n): roda depois da resposta e só se o último registro tiver >15 min.
  after(() => refreshFollowerSnapshotsIfStale());

  const supabase = await createClient();
  const { profile } = await getCurrentUserAndProfile();

  const [tasks, areas, profiles, statuses, goals, socialAccounts, socialSnapshots, socialLinkClicks, instagramAudience, instagramInsights, traffic] =
    await Promise.all([
      listTasks(supabase, { light: true }),
      listAreas(supabase),
      listProfiles(supabase),
      listTaskStatuses(supabase),
      listGoals(supabase),
      listSocialAccounts(supabase),
      listRecentFollowerSnapshots(supabase),
      listRecentLinkClicks(supabase, 30),
      listInstagramAudience(supabase).catch(() => []),
      listInstagramInsights(supabase).catch(() => []),
      loadTrafficDaily(supabase).catch(() => []),
    ]);

  const canManageGoals = profile?.role === "master" || profile?.role === "gestor";
  const timeRows = timeByContentType(tasks);

  // Só o que a dashboard usa, com as datas já no dia de São Paulo — o cliente
  // só compara strings e não precisa receber briefing/legenda/checklists.
  const slimTasks: SlimTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    areaId: t.area_id,
    contentType: t.content_type,
    createdDay: toDateKey(t.created_at),
    completedDay: t.completed_at ? toDateKey(t.completed_at) : null,
    dueDay: t.due_date ? toDateKey(t.due_date) : null,
    dueAt: t.due_date,
    publishDay: t.publish_at ? toDateKey(t.publish_at) : null,
    updatedAt: Date.parse(t.updated_at),
    assigneeIds: (t.assignees || []).map((a) => a.id),
  }));

  const igAccounts = socialAccounts.filter((a) => a.platform === "instagram");
  const followerRows = socialFollowerDeltas(igAccounts, socialSnapshots);
  const latest = followerRows.map((r) => r.latest).filter(Boolean);
  const deltas = followerRows.map((r) => r.delta).filter((d): d is number => d !== null);

  const doneOrCancelled = new Set(statuses.filter((s) => s.is_done || s.is_cancelled).map((s) => s.key));
  const priorityTasks = tasks
    .filter((t) => !doneOrCancelled.has(t.status) && !t.is_archived)
    .sort((a, b) => {
      const order = { urgente: 0, alta: 1, media: 2, baixa: 3 };
      return order[a.priority] - order[b.priority];
    })
    .slice(0, 6);

  return (
    <>
      <RealtimeRefresher tables={["tasks", "task_assignees"]} />
      <HomeDashboard
        firstName={profile?.full_name?.split(" ")[0] || ""}
        tasks={slimTasks}
        statuses={statuses.map((s) => ({ key: s.key, label: s.label, color: s.color, is_done: s.is_done, is_cancelled: s.is_cancelled }))}
        areas={areas.map((a) => ({ id: a.id, name: a.name, color: a.color }))}
        people={profiles.filter((p) => p.is_active !== false).map((p) => ({ id: p.id, name: p.full_name, avatarUrl: p.avatar_url }))}
        instagram={{
          insights: instagramInsights.map((r) => ({
            account_id: r.account_id,
            date: r.date,
            views: r.views,
            reach: r.reach,
            total_interactions: r.total_interactions,
            net_followers: r.net_followers,
          })),
          accounts: igAccounts.map((a) => ({ id: a.id, label: a.label })),
          followersNow: latest.length ? latest.reduce((s, l) => s + (l?.followers_count ?? 0), 0) : null,
          followersDelta: deltas.length ? deltas.reduce((s, d) => s + d, 0) : null,
        }}
        traffic={traffic}
        slots={{
          panels: (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <GoalsPanel goals={goals} tasks={tasks} statuses={statuses} areas={areas} profiles={profiles} canManage={canManageGoals} />
              <TimeManagementCard rows={timeRows} />
              <SocialFollowersCard
                accounts={socialAccounts}
                snapshots={socialSnapshots}
                linkClicks={socialLinkClicks}
                profiles={Object.fromEntries(
                  instagramAudience
                    .filter((a) => a.kind === "profile")
                    .map((a) => [a.account_id, a.data as { username?: string; name?: string; profile_picture_url?: string }])
                )}
                canManage={canManageGoals}
              />
            </div>
          ),
          priority:
            priorityTasks.length === 0 ? (
              <EmptyState title="Você está em dia!" description="Nenhuma tarefa prioritária pendente." />
            ) : (
              <div className="space-y-2">
                {priorityTasks.map((t) => (
                  <TaskListItem key={t.id} task={t} />
                ))}
              </div>
            ),
        }}
      />
    </>
  );
}
