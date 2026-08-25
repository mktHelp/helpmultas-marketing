import { TaskDetailClient } from "@/components/tasks/TaskDetailClient";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TaskDetailClient taskId={id} />;
}
