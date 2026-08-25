"use client";

import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { toast } from "sonner";
import { KanbanColumn } from "./KanbanColumn";
import { STATUS_ORDER, STATUS_LABELS } from "@/components/shared/StatusBadge";
import { createClient } from "@/lib/supabase/client";
import { moveTaskStatus } from "@/lib/services/tasks";
import type { TaskStatus, TaskWithRelations } from "@/types/database";

export function KanbanBoard({ tasks, onRefresh }: { tasks: TaskWithRelations[]; onRefresh: () => void }) {
  const supabase = createClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const newStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === active.id);
    if (!task || task.status === newStatus) return;

    try {
      await moveTaskStatus(supabase, task.id, newStatus);
      toast.success(`Movido para ${STATUS_LABELS[newStatus]}`);
      onRefresh();
    } catch {
      toast.error("Erro ao mover tarefa");
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="kanban-scroll flex gap-4 overflow-x-auto pb-4">
        {STATUS_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            label={STATUS_LABELS[status]}
            tasks={tasks.filter((t) => t.status === status)}
          />
        ))}
      </div>
    </DndContext>
  );
}
