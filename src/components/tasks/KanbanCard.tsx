"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, MessageSquare, Paperclip, CheckSquare } from "lucide-react";
import { PriorityBadge } from "@/components/shared/StatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Tag } from "@/components/ui/Tag";
import { cn, formatDate, isOverdue } from "@/lib/utils";
import type { TaskWithRelations } from "@/types/database";

export function KanbanCard({ task }: { task: TaskWithRelations }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const overdue = isOverdue(task.due_date, task.completed_at);
  const checklistDone = task.checklists?.filter((c) => c.completed).length || 0;
  const checklistTotal = task.checklists?.length || 0;
  const assignees = task.assignees || [];

  // isDragging flips back to false as soon as the drop happens, but the
  // browser still fires a native "click" on the element right after
  // pointerup - by then isDragging is already false, so it doesn't block
  // the Link navigation. A ref (unlike state) survives that gap and lets
  // the click handler know a drag just finished.
  const wasDragging = useRef(false);
  useEffect(() => {
    if (isDragging) wasDragging.current = true;
  }, [isDragging]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab rounded-xl border border-gray-200 bg-white p-3 shadow-[var(--shadow-sm)] active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <Link
        href={`/tasks/${task.id}`}
        onClick={(e) => {
          if (wasDragging.current) {
            e.preventDefault();
            wasDragging.current = false;
          }
        }}
        className="block"
      >
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

        <div className="mt-3 flex items-center justify-between">
          <PriorityBadge priority={task.priority} />
          {assignees.length > 0 && (
            <div className="flex -space-x-1.5">
              {assignees.slice(0, 3).map((a) => (
                <UserAvatar key={a.id} name={a.full_name} avatarUrl={a.avatar_url} size="xs" className="ring-2 ring-white" />
              ))}
              {assignees.length > 3 && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-700 ring-2 ring-white">
                  +{assignees.length - 3}
                </span>
              )}
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
      </Link>
    </div>
  );
}
