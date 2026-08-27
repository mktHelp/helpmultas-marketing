"use client";

import { useTaskStatuses } from "@/lib/task-status-context";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ActivityLog } from "@/types/database";

function describe(log: ActivityLog, statusLabel: (key: unknown) => string): string {
  const m = log.metadata as Record<string, unknown>;

  switch (log.action) {
    case "created":
      return "criou a tarefa";
    case "status_changed":
      return `alterou o status de "${statusLabel(m.from)}" para "${statusLabel(m.to)}"`;
    case "assigned":
      return `atribuiu ${m.user_name || "alguém"} como responsável`;
    case "unassigned":
      return `removeu ${m.user_name || "alguém"} dos responsáveis`;
    case "due_date_changed":
      return m.to
        ? `alterou o prazo para ${formatDate(m.to as string)}`
        : "removeu o prazo";
    case "commented":
      return "adicionou um comentário";
    case "checklist_completed":
      return `concluiu o item "${m.item}"`;
    case "archived":
      return "arquivou a tarefa";
    case "unarchived":
      return "desarquivou a tarefa";
    case "deleted":
      return "excluiu a tarefa";
    case "restored":
      return "restaurou a tarefa";
    default:
      return log.action;
  }
}

export function ActivityTimeline({ logs }: { logs: ActivityLog[] }) {
  const { byKey } = useTaskStatuses();
  const statusLabel = (key: unknown) => (typeof key === "string" && byKey[key]?.label) || String(key ?? "-");

  if (logs.length === 0) return <p className="text-sm text-gray-400">Sem histórico ainda.</p>;

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <div key={log.id} className="flex gap-3 text-sm">
          <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" />
          <p className="text-gray-700">
            <span className="font-semibold text-blue-900">{log.user?.full_name || "Sistema"}</span>{" "}
            {describe(log, statusLabel)}
            <span className="ml-2 text-xs text-gray-400">{formatDateTime(log.created_at)}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
