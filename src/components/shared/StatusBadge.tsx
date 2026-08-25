import { Badge } from "@/components/ui/Badge";
import type { TaskStatus, TaskPriority, ProjectStatus, CampaignStatus } from "@/types/database";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  planejamento: "Planejamento",
  em_producao: "Em Produção",
  em_revisao: "Em Revisão",
  aprovado: "Aprovado",
  publicado: "Publicado",
  concluido: "Concluído",
  pausado: "Pausado",
  cancelado: "Cancelado",
};

export const STATUS_ORDER: TaskStatus[] = [
  "backlog",
  "planejamento",
  "em_producao",
  "em_revisao",
  "aprovado",
  "publicado",
  "concluido",
];

const STATUS_TONE: Record<TaskStatus, "neutral" | "info" | "accent" | "success" | "danger"> = {
  backlog: "neutral",
  planejamento: "info",
  em_producao: "accent",
  em_revisao: "accent",
  aprovado: "info",
  publicado: "success",
  concluido: "success",
  pausado: "neutral",
  cancelado: "danger",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>;
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
