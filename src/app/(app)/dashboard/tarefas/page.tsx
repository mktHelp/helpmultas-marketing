import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/services/tasks";
import { listAreas, listTaskStatuses } from "@/lib/services/reference";
import { listProfiles } from "@/lib/services/profiles";
import { toSlimTask } from "@/lib/home-analytics";
import { TaskProductivityDashboard } from "@/components/dashboard/TaskProductivityDashboard";
import { RealtimeRefresher } from "@/components/shared/RealtimeRefresher";

export default async function TaskProductivityPage() {
  const supabase = await createClient();
  const [tasks, areas, profiles, statuses] = await Promise.all([
    listTasks(supabase, { light: true }),
    listAreas(supabase),
    listProfiles(supabase),
    listTaskStatuses(supabase),
  ]);

  return (
    <>
      <RealtimeRefresher tables={["tasks", "task_assignees"]} />
      <TaskProductivityDashboard
        tasks={tasks.map(toSlimTask)}
        statuses={statuses.map((s) => ({ key: s.key, label: s.label, color: s.color, is_done: s.is_done, is_cancelled: s.is_cancelled }))}
        areas={areas.map((a) => ({ id: a.id, name: a.name, color: a.color }))}
        people={profiles.filter((p) => p.is_active !== false).map((p) => ({ id: p.id, name: p.full_name, avatarUrl: p.avatar_url }))}
      />
    </>
  );
}
