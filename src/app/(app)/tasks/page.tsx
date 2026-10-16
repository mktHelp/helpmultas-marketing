import { Suspense } from "react";
import { TasksWorkspace } from "@/components/tasks/TasksWorkspace";

export default function TasksPage() {
  return (
    <Suspense fallback={null}>
      <TasksWorkspace />
    </Suspense>
  );
}
