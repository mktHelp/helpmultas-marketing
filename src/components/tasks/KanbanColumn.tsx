"use client";

import { useDroppable } from "@dnd-kit/core";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { KanbanCard } from "./KanbanCard";
import type { TaskStatus, TaskWithRelations } from "@/types/database";

export function KanbanColumn({
  status,
  label,
  color,
  tasks,
  index = 0,
}: {
  status: TaskStatus;
  label: string;
  color: string;
  tasks: TaskWithRelations[];
  index?: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="kb-col-in flex h-full w-72 shrink-0 flex-col" style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}>
      <div
        className="mb-2 flex items-center gap-2 rounded-2xl border px-3 py-2.5 shadow-[var(--shadow-sm)]"
        style={{ backgroundColor: `${color}1c`, borderColor: `${color}55`, borderTopWidth: 3, borderTopColor: color }}
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: color }} />
        <p className="min-w-0 flex-1 truncate font-display text-sm font-bold text-blue-900">{label}</p>
        <span
          key={tasks.length}
          className="ast-pop min-w-[1.5rem] rounded-full px-2 py-0.5 text-center text-xs font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "kanban-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border-2 border-dashed p-2 transition-all duration-200",
          isOver && "scale-[1.01]"
        )}
        style={{
          backgroundColor: isOver ? `${color}30` : `${color}0d`,
          borderColor: isOver ? color : "transparent",
        }}
      >
        {tasks.map((t, i) => (
          <KanbanCard key={t.id} task={t} accent={color} index={i} />
        ))}
        {tasks.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl py-8 text-center text-xs font-semibold" style={{ color }}>
            <Inbox className="h-6 w-6 opacity-60" />
            <span className="opacity-80">{isOver ? "Solte aqui" : "Nenhuma tarefa"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
