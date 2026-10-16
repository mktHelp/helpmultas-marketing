"use client";

import { AlertTriangle, Flame, Newspaper } from "lucide-react";
import { ACCOUNT_LABEL } from "@/lib/services/contentIdeas";
import type { ContentIdea } from "@/types/database";
import { cn } from "@/lib/utils";
import { FORMAT_COLOR, FORMAT_LABEL, TIER_LABEL, ageLabel, freshness } from "./ideaMeta";

export function IdeaBadges({ idea }: { idea: ContentIdea }) {
  const fresh = freshness(idea);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
      <span className={cn("rounded-full px-2 py-0.5", FORMAT_COLOR[idea.format])}>{FORMAT_LABEL[idea.format]}</span>
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{ACCOUNT_LABEL[idea.account]}</span>
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5", fresh.className)}>
        <span className={cn("h-1.5 w-1.5 rounded-full", fresh.dot)} />
        {fresh.label}
      </span>
      {idea.variation_of && <span className="rounded-full bg-blue-050 px-2 py-0.5 text-blue-700">Variação</span>}
      {idea.needs_check && (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-orange-700" title={idea.check_note ?? undefined}>
          <AlertTriangle className="h-3 w-3" /> Conferir
        </span>
      )}
    </div>
  );
}

export function ScorePill({ score, big }: { score: number | null; big?: boolean }) {
  if (score == null) return null;
  const tone = score >= 75 ? "bg-red-500 text-white" : score >= 55 ? "bg-yellow-500 text-blue-900" : "bg-gray-200 text-gray-700";
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full font-bold", tone, big ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-[11px]")}>
      <Flame className={big ? "h-4 w-4" : "h-3 w-3"} /> {score}
    </span>
  );
}

export function SourceLine({ idea, className }: { idea: ContentIdea; className?: string }) {
  if (!idea.source_url && !idea.source_name) return null;
  const meta = [idea.source_name, ageLabel(idea), idea.source_tier ? TIER_LABEL[idea.source_tier] : null].filter(Boolean).join(" · ");
  return (
    <p className={cn("flex items-center gap-1.5 text-xs text-gray-500", className)}>
      <Newspaper className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{meta}</span>
    </p>
  );
}

/** Card compacto: só o essencial. O resto abre na gaveta lateral. */
export function IdeaCard({ idea, onOpen, index = 0 }: { idea: ContentIdea; onOpen: () => void; index?: number }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
      className={cn(
        "kb-card-in flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-[var(--shadow-md)]",
        idea.status === "descartada" && "opacity-60"
      )}
    >
      <div className="mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <IdeaBadges idea={idea} />
        </div>
        <ScorePill score={idea.score} />
      </div>
      <h3 className="font-display text-[15px] font-bold leading-snug text-blue-900">{idea.title}</h3>
      {idea.hook && <p className="mt-1.5 line-clamp-2 text-sm text-gray-700">“{idea.hook}”</p>}
      <div className="mt-auto pt-3">
        <SourceLine idea={idea} />
        {idea.status !== "nova" && (
          <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">{idea.status === "aprovada" ? "Aprovada" : "Descartada"}</p>
        )}
      </div>
    </button>
  );
}
