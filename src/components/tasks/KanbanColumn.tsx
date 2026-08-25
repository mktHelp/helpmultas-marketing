"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { KanbanCard } from "./KanbanCard";
import type { TaskStatus, TaskWithRelations } from "@/types/database";

export function KanbanColumn({
  status,
  label,
  tasks,
}: {
  status: TaskStatus;
  label: string;
  tasks: TaskWithRelations[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="font-display text-sm font-bold text-blue-900">{label}</p>
        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-700">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[200px] flex-1 flex-col gap-2 rounded-2xl border-2 border-dashed border-transparent bg-gray-100/50 p-2 transition-colors",
          isOver && "border-yellow-500 bg-yellow-050"
        )}
      >
        {tasks.map((t) => <KanbanCard key={t.id} task={t} />)}
      </div>
    </div>
  );
}
