import { Suspense } from "react";
import { TasksWorkspace } from "@/components/tasks/TasksWorkspace";

export default function ContentPage() {
  return (
    <Suspense fallback={null}>
      <TasksWorkspace contentOnly />
    </Suspense>
  );
}
