"use client";

import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { toast } from "sonner";
import { KanbanColumn } from "./KanbanColumn";
import { useTaskStatuses } from "@/lib/task-status-context";
import { createClient } from "@/lib/supabase/client";
import { moveTaskStatus } from "@/lib/services/tasks";
import type { TaskWithRelations } from "@/types/database";

export function KanbanBoard({ tasks, onRefresh }: { tasks: TaskWithRelations[]; onRefresh: () => void }) {
  const supabase = createClient();
  const { activeStatuses, byKey } = useTaskStatuses();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const newStatus = String(over.id);
    const task = tasks.find((t) => t.id === active.id);
    if (!task || task.status === newStatus) return;

    try {
      await moveTaskStatus(supabase, task.id, newStatus);
      toast.success(`Movido para ${byKey[newStatus]?.label || newStatus}`);
      onRefresh();
    } catch {
      toast.error("Erro ao mover tarefa");
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="kanban-scroll flex gap-4 overflow-x-auto pb-4">
        {activeStatuses.map((status) => (
          <KanbanColumn
            key={status.key}
            status={status.key}
            label={status.label}
            tasks={tasks.filter((t) => t.status === status.key)}
          />
        ))}
      </div>
    </DndContext>
  );
}
