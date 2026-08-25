import { formatDateTime } from "@/lib/utils";
import type { ActivityLog } from "@/types/database";

const ACTION_LABELS: Record<string, (m: Record<string, unknown>) => string> = {
  created: () => "criou a tarefa",
  status_changed: (m) => `alterou o status de "${m.from}" para "${m.to}"`,
  reassigned: () => "alterou o responsável",
  due_date_changed: () => "alterou o prazo",
  commented: () => "adicionou um comentário",
  checklist_completed: (m) => `concluiu o item "${m.item}"`,
};

export function ActivityTimeline({ logs }: { logs: ActivityLog[] }) {
  if (logs.length === 0) return <p className="text-sm text-gray-400">Sem histórico ainda.</p>;

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <div key={log.id} className="flex gap-3 text-sm">
          <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" />
          <p className="text-gray-700">
            <span className="font-semibold text-blue-900">{log.user?.full_name || "Alguém"}</span>{" "}
            {(ACTION_LABELS[log.action] || (() => log.action))(log.metadata)}
            <span className="ml-2 text-xs text-gray-400">{formatDateTime(log.created_at)}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
