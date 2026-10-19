import { createClient } from "@/lib/supabase/server";
import { listStatusMoves, listTasks } from "@/lib/services/tasks";
import { listTaskStatuses } from "@/lib/services/reference";
import { listProfiles } from "@/lib/services/profiles";
import { listCampaigns, listProjects } from "@/lib/services/projects";
import { listContentIdeas } from "@/lib/services/contentIdeas";
import { toSlimTask } from "@/lib/home-analytics";
import { PlanningDashboard } from "@/components/dashboard/PlanningDashboard";
import { RealtimeRefresher } from "@/components/shared/RealtimeRefresher";
import { toDateKey } from "@/lib/utils";
import { shiftDate, todayBRT } from "@/lib/period";

// Janela de histórico: cobre o maior período (60 dias) + o período anterior.
const HISTORY_DAYS = 130;

export default async function PlanningProductivityPage() {
  const supabase = await createClient();
  const since = `${shiftDate(todayBRT(), -HISTORY_DAYS)}T03:00:00Z`;
  const [tasks, profiles, statuses, projects, campaigns, ideas, moves] = await Promise.all([
    listTasks(supabase, { light: true }),
    listProfiles(supabase),
    listTaskStatuses(supabase),
    listProjects(supabase),
    listCampaigns(supabase),
    listContentIdeas(supabase, HISTORY_DAYS).catch(() => []),
    listStatusMoves(supabase, since).catch(() => []),
  ]);

  return (
    <>
      <RealtimeRefresher tables={["tasks", "projects", "campaigns", "content_ideas"]} />
      <PlanningDashboard
        tasks={tasks.map(toSlimTask)}
        statuses={statuses.map((s) => ({ key: s.key, label: s.label, is_done: s.is_done, is_cancelled: s.is_cancelled }))}
        people={profiles.map((p) => ({ id: p.id, name: p.full_name, avatarUrl: p.avatar_url }))}
        projects={projects.map((p) => ({
          id: p.id, name: p.name, status: p.status, priority: p.priority, progress: p.progress ?? 0, ownerId: p.owner_id,
          startDay: p.start_date ? p.start_date.slice(0, 10) : null, endDay: p.end_date ? p.end_date.slice(0, 10) : null,
        }))}
        campaigns={campaigns.map((c) => ({
          id: c.id, name: c.name, status: c.status, budget: c.budget, ownerId: c.owner_id,
          startDay: c.start_date ? c.start_date.slice(0, 10) : null, endDay: c.end_date ? c.end_date.slice(0, 10) : null,
        }))}
        ideas={ideas.map((i) => ({
          id: i.id, batchDay: i.batch_date, decidedDay: i.decided_at ? toDateKey(i.decided_at) : null,
          status: i.status, format: i.format, account: i.account, taskId: i.task_id,
        }))}
        moves={moves.map((m) => ({ taskId: m.taskId, from: m.from, to: m.to, day: toDateKey(m.at) }))}
      />
    </>
  );
}
