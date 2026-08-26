"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { AlertTriangle, MessageSquare, Paperclip, CheckSquare } from "lucide-react";
import { PriorityBadge } from "@/components/shared/StatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Tag } from "@/components/ui/Tag";
import { cn, formatDate, isOverdue } from "@/lib/utils";
import type { TaskWithRelations } from "@/types/database";

export function KanbanCardContent({ task }: { task: TaskWithRelations }) {
  const overdue = isOverdue(task.due_date, task.completed_at);
  const checklistDone = task.checklists?.filter((c) => c.completed).length || 0;
  const checklistTotal = task.checklists?.length || 0;
  const assignees = task.assignees || [];

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-blue-900">{task.title}</p>
      </div>

      {task.tags && task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map((t) => <Tag key={t.id} label={t.name} color={t.color} />)}
        </div>
      )}

      {(task.project || task.campaign) && (
        <p className="mt-1.5 text-xs text-gray-400">{task.project?.name || task.campaign?.name}</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <PriorityBadge priority={task.priority} />
        {assignees.length > 0 && (
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="flex -space-x-1.5">
              {assignees.slice(0, 3).map((a) => (
                <UserAvatar key={a.id} name={a.full_name} avatarUrl={a.avatar_url} size="xs" className="ring-2 ring-white" />
              ))}
            </div>
            <span className="truncate text-xs font-medium text-gray-600">
              {assignees.length === 1
                ? assignees[0].full_name.split(" ")[0]
                : `${assignees[0].full_name.split(" ")[0]} +${assignees.length - 1}`}
            </span>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-400">
        {task.due_date && (
          <span className={cn("flex items-center gap-1", overdue && "font-bold text-[color:var(--color-danger)]")}>
            {overdue && <AlertTriangle className="h-3 w-3" />}
            {formatDate(task.due_date)}
          </span>
        )}
        {checklistTotal > 0 && (
          <span className="flex items-center gap-1"><CheckSquare className="h-3 w-3" />{checklistDone}/{checklistTotal}</span>
        )}
        {(task.comments_count || 0) > 0 && (
          <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{task.comments_count}</span>
        )}
        {(task.attachments_count || 0) > 0 && (
          <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" />{task.attachments_count}</span>
        )}
      </div>
    </>
  );
}

// The card rendered while being dragged, inside <DragOverlay>. It's portaled
// to the document body by dnd-kit, so it's free of the column's overflow
// clipping/stacking context - this is what actually follows the cursor.
export function KanbanCardOverlay({ task }: { task: TaskWithRelations }) {
  return (
    <div className="w-72 cursor-grabbing rounded-xl border border-gray-200 bg-white p-3 shadow-[var(--shadow-lg)]">
      <KanbanCardContent task={task} />
    </div>
  );
}

export function KanbanCard({ task }: { task: TaskWithRelations }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab rounded-xl border border-gray-200 bg-white p-3 shadow-[var(--shadow-sm)] active:cursor-grabbing",
        isDragging && "opacity-0"
      )}
    >
      <Link href={`/tasks/${task.id}`} className="block">
        <KanbanCardContent task={task} />
      </Link>
    </div>
  );
}
