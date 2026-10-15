"use client";

import { Badge } from "@/components/ui/Badge";
import { useTaskStatuses } from "@/lib/task-status-context";
import type { TaskPriority, ProjectStatus, CampaignStatus } from "@/types/database";

export function StatusBadge({ status }: { status: string }) {
  const { byKey } = useTaskStatuses();
  const s = byKey[status];

  if (!s) {
    return <Badge tone="neutral">{status}</Badge>;
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold"
      style={{ backgroundColor: `${s.color}1a`, color: s.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
      {s.label}
    </span>
  );
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

const PRIORITY_TONE: Record<TaskPriority, "neutral" | "info" | "accent" | "danger"> = {
  baixa: "neutral",
  media: "info",
  alta: "accent",
  urgente: "danger",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABELS[priority]}</Badge>;
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em Andamento",
  pausado: "Pausado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  planejamento: "Planejamento",
  ativa: "Ativa",
  pausada: "Pausada",
  encerrada: "Encerrada",
};
