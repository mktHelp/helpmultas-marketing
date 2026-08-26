"use client";

import { useEffect, useRef } from "react";
import { DndContext, type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
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

  // A real drag (distance > activation constraint) still ends with the
  // browser dispatching a normal "click" right after pointerup, on
  // whichever element the pointer happens to be over at that instant - not
  // necessarily the card that started the drag. Blocking it per-card isn't
  // reliable, so instead: once dnd-kit tells us a drag session actually
  // started, swallow the very next click anywhere on the board in the
  // capture phase, before it can reach any Link's onClick.
  const suppressNextClick = useRef(false);

  useEffect(() => {
    function onClickCapture(e: MouseEvent) {
      if (suppressNextClick.current) {
        e.preventDefault();
        e.stopPropagation();
        suppressNextClick.current = false;
      }
    }
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, []);

  function handleDragStart(_event: DragStartEvent) {
    suppressNextClick.current = true;
  }

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
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="kanban-scroll flex h-[calc(100vh-260px)] min-h-[420px] gap-4 overflow-x-auto pb-4">
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
