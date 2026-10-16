import type { ContentIdea } from "@/types/database";

export const FORMAT_LABEL: Record<ContentIdea["format"], string> = { reels: "Reels", feed: "Feed", carrossel: "Carrossel", stories: "Stories" };
export const FORMAT_COLOR: Record<ContentIdea["format"], string> = {
  reels: "bg-pink-100 text-pink-700",
  feed: "bg-blue-100 text-blue-800",
  carrossel: "bg-violet-100 text-violet-700",
  stories: "bg-amber-100 text-amber-800",
};

export const TIER_LABEL: Record<number, string> = { 1: "Fonte oficial", 2: "Grande portal", 3: "Outra fonte" };

export const SCORE_PARTS: { key: "bolso" | "alcance" | "frescor" | "polemica"; label: string }[] = [
  { key: "bolso", label: "Impacto no bolso" },
  { key: "alcance", label: "Alcance" },
  { key: "frescor", label: "Frescor" },
  { key: "polemica", label: "Polêmica" },
];

/** Idade da notícia em horas (usa a data da notícia; sem ela, a da pauta). */
export function ideaAgeHours(idea: ContentIdea, now = Date.now()) {
  const ref = idea.source_published_at ?? idea.created_at;
  return (now - new Date(ref).getTime()) / 3600e3;
}

/** Selo de frescor: notícia de trânsito perde força rápido. */
export function freshness(idea: ContentIdea, now = Date.now()) {
  const h = ideaAgeHours(idea, now);
  if (h < 6) return { label: "Quente", className: "bg-red-100 text-red-700", dot: "bg-red-500" };
  if (h < 24) return { label: "Hoje", className: "bg-yellow-100 text-yellow-800", dot: "bg-yellow-500" };
  return { label: "Esfriando", className: "bg-gray-100 text-gray-600", dot: "bg-gray-400" };
}

export function ageLabel(idea: ContentIdea, now = Date.now()) {
  const h = ideaAgeHours(idea, now);
  if (h < 1) return "há menos de 1h";
  if (h < 24) return `há ${Math.round(h)}h`;
  const d = Math.round(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}
