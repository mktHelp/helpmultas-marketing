import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PriorityBadge, StatusBadge } from "@/components/shared/StatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { formatDate, isOverdue, cn } from "@/lib/utils";
import type { TaskWithRelations } from "@/types/database";

export function TaskListItem({ task }: { task: TaskWithRelations }) {
  const overdue = isOverdue(task.due_date, task.completed_at);
  return (
    <Link
      href={`/tasks/${task.id}`}
      className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5 hover:border-gray-200 hover:bg-gray-050 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-blue-900">{task.title}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
          {task.area && <span>{task.area.name}</span>}
          {task.due_date && (
            <span className={cn("flex items-center gap-1", overdue && "font-semibold text-[color:var(--color-danger)]")}>
              {overdue && <AlertTriangle className="h-3 w-3" />}
              {formatDate(task.due_date)}
            </span>
          )}
        </div>
      </div>
      <PriorityBadge priority={task.priority} />
      <StatusBadge status={task.status} />
      {task.assignee && <UserAvatar name={task.assignee.full_name} avatarUrl={task.assignee.avatar_url} size="sm" />}
    </Link>
  );
}
