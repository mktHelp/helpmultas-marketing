"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, CalendarPlus, Check, ExternalLink, Lightbulb, Mic, Newspaper, RotateCcw, Sparkles, X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { UserAvatar } from "@/components/shared/UserAvatar";
import type { ContentIdea, Profile } from "@/types/database";
import { cn } from "@/lib/utils";
import { IdeaBadges, ScorePill } from "./IdeaCard";
import { SCORE_PARTS, TIER_LABEL, ageLabel } from "./ideaMeta";

export interface IdeaActions {
  onApprove: (opts?: { dueDate?: string | null; assigneeIds?: string[] }) => void;
  onTeleprompter: () => void;
  onDiscard: () => void;
  onReopen: () => void;
  onVariation: () => void;
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
      {children}
    </div>
  );
}

/** Gaveta lateral com a pauta completa: nota detalhada, roteiro, legenda, fontes e ações. */
export function IdeaDrawer({
  idea, busy, profiles, actions, onClose,
}: {
  idea: ContentIdea;
  busy: boolean;
  profiles: Profile[];
  actions: IdeaActions;
  onClose: () => void;
}) {
  const [scheduling, setScheduling] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const isVideo = idea.format === "reels" || idea.format === "stories";

  useEffect(() => {
    setScheduling(false);
    setDueDate("");
    setAssignees([]);
  }, [idea.id]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-4">
        <div className="min-w-0 flex-1">
          <IdeaBadges idea={idea} />
          <h2 className="mt-2 font-display text-lg font-bold leading-snug text-blue-900">{idea.title}</h2>
          {idea.theme && <p className="mt-0.5 text-xs font-semibold text-gray-500">Tema: {idea.theme}</p>}
        </div>
        <ScorePill score={idea.score} big />
        <button type="button" onClick={onClose} aria-label="Fechar pauta" className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm text-gray-800">
        {idea.needs_check && (
          <div className="flex gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p><b>Conferir antes de publicar.</b> {idea.check_note ?? "Confira valores, pontos e artigos citados."}</p>
          </div>
        )}

        {idea.hook && (
          <Block label="Gancho">
            <p className="font-display text-base font-semibold text-blue-900">“{idea.hook}”</p>
          </Block>
        )}

        {idea.why && (
          <Block label="Por que deve funcionar">
            <p className="flex gap-2 text-gray-700"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />{idea.why}</p>
          </Block>
        )}

        {idea.score_breakdown && (
          <Block label="Nota">
            <div className="space-y-2">
              {SCORE_PARTS.map((p) => {
                const v = idea.score_breakdown?.[p.key] ?? 0;
                return (
                  <div key={p.key} className="flex items-center gap-3 text-xs">
                    <span className="w-28 shrink-0 font-semibold text-gray-600">{p.label}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <span className="block h-full rounded-full bg-yellow-500" style={{ width: `${(v / 25) * 100}%` }} />
                    </span>
                    <span className="w-9 text-right font-bold text-blue-900">{v}/25</span>
                  </div>
                );
              })}
            </div>
          </Block>
        )}

        {idea.script && (
          <Block label={idea.format === "carrossel" ? "Slides" : idea.format === "stories" ? "Telas" : "Roteiro"}>
            <p className="whitespace-pre-line rounded-xl bg-gray-050 p-3 leading-relaxed">{idea.script}</p>
          </Block>
        )}
        {idea.caption && (
          <Block label="Legenda">
            <p className="whitespace-pre-line rounded-xl bg-gray-050 p-3 leading-relaxed">{idea.caption}</p>
          </Block>
        )}
        {idea.cta && (
          <Block label="CTA">
            <p>{idea.cta}</p>
          </Block>
        )}

        {(idea.source_url || idea.reference_permalink) && (
          <Block label="Fontes">
            <div className="space-y-2 text-xs">
              {idea.source_url && (
                <a href={idea.source_url} target="_blank" rel="noreferrer" className="flex items-start gap-2 rounded-xl border border-gray-200 p-2.5 hover:border-blue-200 hover:bg-blue-050">
                  <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-blue-900">{idea.source_title ?? idea.source_url}</span>
                    <span className="text-gray-500">
                      {[idea.source_name, ageLabel(idea), idea.source_tier ? TIER_LABEL[idea.source_tier] : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </a>
              )}
              {idea.reference_permalink && (
                <a href={idea.reference_permalink} target="_blank" rel="noreferrer" className="flex items-start gap-2 rounded-xl border border-gray-200 p-2.5 hover:border-blue-200 hover:bg-blue-050">
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-blue-900">Post de referência</span>
                    {idea.reference_note && <span className="text-gray-500">{idea.reference_note}</span>}
                  </span>
                </a>
              )}
            </div>
          </Block>
        )}

        {idea.status !== "nova" && (idea.task_id || idea.teleprompter_script_id) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {idea.task_id && <Link href={`/tasks/${idea.task_id}`} className="text-xs font-bold text-blue-800 hover:underline">Abrir tarefa →</Link>}
            {idea.teleprompter_script_id && <Link href="/teleprompter" className="text-xs font-bold text-blue-800 hover:underline">Abrir no Teleprompter →</Link>}
          </div>
        )}

        {scheduling && (
          <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-050/60 p-3">
            <p className="font-display text-sm font-bold text-blue-900">Agendar no calendário</p>
            <label className="block text-xs font-semibold text-gray-600">
              Data de publicação
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-blue-900 outline-none focus:border-blue-900"
              />
            </label>
            {profiles.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold text-gray-600">Responsáveis</p>
                <div className="flex flex-wrap gap-1.5">
                  {profiles.map((p) => {
                    const on = assignees.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setAssignees(on ? assignees.filter((x) => x !== p.id) : [...assignees, p.id])}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs font-semibold transition-colors",
                          on ? "border-transparent bg-blue-900 text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-050"
                        )}
                      >
                        <UserAvatar name={p.full_name} avatarUrl={p.avatar_url} size="xs" />
                        {p.full_name.split(" ")[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy || !dueDate}
                onClick={() => actions.onApprove({ dueDate: `${dueDate}T12:00:00-03:00`, assigneeIds: assignees })}
                className="gap-1"
              >
                <CalendarPlus className="h-4 w-4" /> Criar tarefa agendada
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setScheduling(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-gray-100 bg-white p-3">
        {idea.status === "nova" ? (
          <>
            <Button size="sm" onClick={() => actions.onApprove()} disabled={busy} className="gap-1"><Check className="h-4 w-4" /> Virar tarefa</Button>
            <Button size="sm" variant="secondary" onClick={() => setScheduling((v) => !v)} disabled={busy} className="gap-1">
              <CalendarPlus className="h-4 w-4" /> Agendar
            </Button>
            {isVideo && (
              <Button size="sm" variant="secondary" onClick={actions.onTeleprompter} disabled={busy} className="gap-1"><Mic className="h-4 w-4" /> Teleprompter</Button>
            )}
            <Button size="sm" variant="secondary" onClick={actions.onVariation} disabled={busy} className="gap-1">
              <Sparkles className="h-4 w-4" /> {busy ? "Gerando…" : "Gerar variação"}
            </Button>
            <Button size="sm" variant="ghost" onClick={actions.onDiscard} disabled={busy} className="gap-1"><X className="h-4 w-4" /> Descartar</Button>
          </>
        ) : (
          <>
            {idea.status === "aprovada" && isVideo && !idea.teleprompter_script_id && (
              <Button size="sm" variant="secondary" onClick={actions.onTeleprompter} disabled={busy} className="gap-1"><Mic className="h-4 w-4" /> Teleprompter</Button>
            )}
            <Button size="sm" variant="ghost" onClick={actions.onReopen} disabled={busy} className="gap-1"><RotateCcw className="h-4 w-4" /> Voltar para Novas</Button>
          </>
        )}
      </div>
    </div>
  );
}
