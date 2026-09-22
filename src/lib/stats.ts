import { differenceInDays, endOfDay, isAfter, isBefore, parseISO, startOfDay, subDays } from "date-fns";
import { toDateKey } from "@/lib/utils";
import type { Area, Goal, Profile, SocialAccount, SocialFollowerSnapshot, TaskStatusRow, TaskWithRelations } from "@/types/database";

function statusFlags(statuses: TaskStatusRow[]) {
  const doneKeys = new Set(statuses.filter((s) => s.is_done).map((s) => s.key));
  const cancelledKeys = new Set(statuses.filter((s) => s.is_cancelled).map((s) => s.key));
  return { doneKeys, cancelledKeys };
}

export function filterByPeriod(tasks: TaskWithRelations[], days: number) {
  const cutoff = subDays(new Date(), days);
  return tasks.filter((t) => isAfter(parseISO(t.created_at), cutoff));
}

export function computeKpis(tasks: TaskWithRelations[], statuses: TaskStatusRow[]) {
  const { doneKeys, cancelledKeys } = statusFlags(statuses);
  const open = tasks.filter((t) => !doneKeys.has(t.status) && !cancelledKeys.has(t.status)).length;
  const completed = tasks.filter((t) => doneKeys.has(t.status)).length;
  const overdue = tasks.filter(
    (t) =>
      t.due_date &&
      !t.completed_at &&
      !doneKeys.has(t.status) &&
      !cancelledKeys.has(t.status) &&
      isBefore(parseISO(t.due_date), new Date())
  ).length;
  const todayKey = toDateKey(new Date());
  const dueToday = tasks.filter((t) => t.due_date && toDateKey(t.due_date) === todayKey && !t.completed_at).length;
  const inProduction = tasks.filter((t) => t.status === "em_producao").length;
  const total = tasks.length || 1;
  const completionRate = Math.round((completed / total) * 100);

  return { open, completed, overdue, dueToday, inProduction, completionRate, total: tasks.length };
}

// Progress of a goal against the tasks it scopes to.
// - "tasks_completed": completions inside [period_start, period_end].
// - "on_time_rate": % of those completions that landed on/before their
//   due_date (tasks with no due_date don't count toward either side).
// - "content_published": tasks of the goal's content_type published
//   (publish_at) inside the period — e.g. "4 Instagram stories this week".
// A recurring goal (e.g. "1 story every day, forever") has no period_end —
// its window is always "today" instead of the stored period.
export function computeGoalProgress(goal: Goal, tasks: TaskWithRelations[], statuses: TaskStatusRow[]) {
  const { doneKeys } = statusFlags(statuses);
  const start = goal.is_recurring ? startOfDay(new Date()) : parseISO(goal.period_start);
  const end = goal.is_recurring ? endOfDay(new Date()) : endOfDay(parseISO(goal.period_end!));

  const inScope = tasks.filter((t) => {
    if (goal.scope === "area") return t.area_id === goal.area_id;
    if (goal.scope === "user") return (t.assignees || []).some((a) => a.id === goal.user_id);
    return true;
  });

  let current: number;
  if (goal.metric === "content_published") {
    current = inScope.filter((t) => {
      if (t.content_type !== goal.content_type || !t.publish_at) return false;
      const published = parseISO(t.publish_at);
      return !isBefore(published, start) && !isAfter(published, end);
    }).length;
  } else {
    const completedInPeriod = inScope.filter((t) => {
      if (!doneKeys.has(t.status) || !t.completed_at) return false;
      const completed = parseISO(t.completed_at);
      return !isBefore(completed, start) && !isAfter(completed, end);
    });

    if (goal.metric === "tasks_completed") {
      current = completedInPeriod.length;
    } else {
      const withDueDate = completedInPeriod.filter((t) => t.due_date);
      const onTime = withDueDate.filter((t) => !isAfter(parseISO(t.completed_at!), parseISO(t.due_date!)));
      current = withDueDate.length > 0 ? Math.round((onTime.length / withDueDate.length) * 100) : 0;
    }
  }

  const percent = goal.target_value > 0 ? Math.min(100, Math.round((current / goal.target_value) * 100)) : 0;
  return { current, target: goal.target_value, percent };
}

// Day-over-day follower change per account, from intraday snapshots (the
// automated poller writes one every 15 minutes, so there can be many rows
// per day). Compares the most recent snapshot against the last snapshot
// from the closest earlier day, so the delta reads as "since yesterday"
// rather than noise between two 15-minute polls.
export function socialFollowerDeltas(
  accounts: SocialAccount[],
  snapshots: SocialFollowerSnapshot[]
) {
  return accounts.map((account) => {
    const rows = snapshots
      .filter((s) => s.account_id === account.id)
      .sort((a, b) => b.captured_at.localeCompare(a.captured_at));
    const latest = rows[0] ?? null;
    const previous = latest
      ? rows.find((s) => s.snapshot_date < latest.snapshot_date) ?? null
      : null;
    const delta = latest && previous ? latest.followers_count - previous.followers_count : null;
    // Immediately preceding poll (any date) — with the automation running
    // hourly, this is "what it was ~1h ago", distinct from `previous`
    // which skips ahead to yesterday's last reading.
    const hourAgo = rows[1] ?? null;
    return { account, latest, previous, delta, hourAgo };
  });
}

// One row per day (the last snapshot captured that day) plus its
// day-over-day delta — the shape the follower history chart/table need.
export function dailyFollowerHistory(snapshots: SocialFollowerSnapshot[]) {
  const byDay = new Map<string, SocialFollowerSnapshot>();
  for (const s of snapshots) {
    const existing = byDay.get(s.snapshot_date);
    if (!existing || s.captured_at > existing.captured_at) byDay.set(s.snapshot_date, s);
  }
  const days = Array.from(byDay.keys()).sort();
  let previousCount: number | null = null;
  return days.map((date) => {
    const snapshot = byDay.get(date)!;
    const delta = previousCount === null ? null : snapshot.followers_count - previousCount;
    previousCount = snapshot.followers_count;
    const [, mm, dd] = date.split("-");
    return { date, label: `${dd}/${mm}`, followers: snapshot.followers_count, delta };
  });
}

export const CONTENT_TYPE_LABEL: Record<string, string> = {
  reels: "Reels", stories: "Stories", feed: "Feed", carrossel: "Carrossel",
  youtube: "YouTube", blog: "Blog", email: "E-mail", whatsapp: "WhatsApp",
  anuncio: "Anúncio", landing_page: "Landing page",
};

// Estimated vs. actual minutes, averaged per content type, for tasks that
// logged both — the raw material for "how's my editing time trending"
// answers (dashboard widget and the Helpinho tool read the same shape).
export function timeByContentType(tasks: TaskWithRelations[]) {
  const groups = new Map<string, { estimated: number[]; actual: number[] }>();
  for (const t of tasks) {
    if (!t.content_type || t.estimated_minutes == null || t.actual_minutes == null) continue;
    const g = groups.get(t.content_type) || { estimated: [], actual: [] };
    g.estimated.push(t.estimated_minutes);
    g.actual.push(t.actual_minutes);
    groups.set(t.content_type, g);
  }

  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

  return Array.from(groups.entries())
    .map(([contentType, g]) => {
      const estimatedAvg = avg(g.estimated);
      const actualAvg = avg(g.actual);
      return {
        contentType,
        label: CONTENT_TYPE_LABEL[contentType] || contentType,
        estimatedAvg,
        actualAvg,
        diffMinutes: actualAvg - estimatedAvg,
        sampleSize: g.actual.length,
      };
    })
    .sort((a, b) => b.sampleSize - a.sampleSize);
}

export function byArea(tasks: TaskWithRelations[], areas: Area[]) {
  const total = tasks.length || 1;
  return areas
    .map((a) => {
      const count = tasks.filter((t) => t.area_id === a.id).length;
      return { name: a.name, color: a.color, count, percent: Math.round((count / total) * 100) };
    })
    .filter((a) => a.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function byStatus(tasks: TaskWithRelations[], statuses: TaskStatusRow[]) {
  return statuses
    .map((s) => ({
      status: s.key,
      label: s.label,
      color: s.color,
      count: tasks.filter((t) => t.status === s.key).length,
    }))
    .filter((s) => s.count > 0);
}

export function productivityByDay(tasks: TaskWithRelations[], days: number) {
  const result: { date: string; label: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = subDays(new Date(), i);
    const dateStr = toDateKey(day);
    const count = tasks.filter((t) => t.completed_at && toDateKey(t.completed_at) === dateStr).length;
    const [, mm, dd] = dateStr.split("-");
    result.push({ date: dateStr, label: `${dd}/${mm}`, count });
  }
  return result;
}

export function teamRanking(tasks: TaskWithRelations[], profiles: Profile[], statuses: TaskStatusRow[]) {
  const { doneKeys } = statusFlags(statuses);
  return profiles
    .map((p) => {
      const own = tasks.filter((t) => t.assignees?.some((a) => a.id === p.id));
      const completed = own.filter((t) => doneKeys.has(t.status));
      const overdue = own.filter(
        (t) => t.due_date && !t.completed_at && !doneKeys.has(t.status) && isBefore(parseISO(t.due_date), new Date())
      );
      // Some "done" tasks may not have completed_at set (e.g. created directly
      // in a done stage, before a stage was marked done, etc.) - exclude those
      // from the average instead of crashing on parseISO(null).
      const withCompletionDate = completed.filter((t) => t.completed_at);
      const avgDays =
        withCompletionDate.length > 0
          ? Math.round(
              withCompletionDate.reduce(
                (sum, t) => sum + differenceInDays(parseISO(t.completed_at!), parseISO(t.created_at)),
                0
              ) / withCompletionDate.length
            )
          : 0;
      return {
        profile: p,
        total: own.length,
        completed: completed.length,
        overdue: overdue.length,
        completionRate: own.length ? Math.round((completed.length / own.length) * 100) : 0,
        avgDays,
      };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.completed - a.completed);
}

export function bottlenecks(tasks: TaskWithRelations[], statuses: TaskStatusRow[]) {
  const { doneKeys, cancelledKeys } = statusFlags(statuses);
  const now = new Date();
  const overdue = tasks.filter(
    (t) =>
      t.due_date &&
      !t.completed_at &&
      isBefore(parseISO(t.due_date), now) &&
      !doneKeys.has(t.status) &&
      !cancelledKeys.has(t.status)
  );
  const unassigned = tasks.filter(
    (t) => !(t.assignees && t.assignees.length) && !doneKeys.has(t.status) && !cancelledKeys.has(t.status)
  );
  const stuck = tasks.filter(
    (t) => !doneKeys.has(t.status) && !cancelledKeys.has(t.status) && differenceInDays(now, parseISO(t.updated_at)) >= 5
  );
  const awaitingApproval = tasks.filter((t) => t.status === "em_revisao" || t.status === "aprovado");
  const dueSoon = tasks.filter(
    (t) =>
      t.due_date &&
      !t.completed_at &&
      differenceInDays(parseISO(t.due_date), now) <= 2 &&
      differenceInDays(parseISO(t.due_date), now) >= 0
  );

  return { overdue, unassigned, stuck, awaitingApproval, dueSoon };
}
