"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, ExternalLink, Lightbulb, Mic, Newspaper, RotateCcw, Sparkles, X } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog, DialogHeader, DialogBody } from "@/components/ui/Dialog";
import { RadarRunPanel } from "@/components/pautas/RadarRunPanel";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import {
  ACCOUNT_LABEL, approveIdeaAsTask, discardIdea, listContentIdeas, markIdeasSeen, reopenIdea, sendIdeaToTeleprompter,
} from "@/lib/services/contentIdeas";
import type { ContentIdea } from "@/types/database";
import { cn } from "@/lib/utils";

const FORMAT_LABEL: Record<ContentIdea["format"], string> = { reels: "Reels", feed: "Feed", carrossel: "Carrossel", stories: "Stories" };
const FORMAT_COLOR: Record<ContentIdea["format"], string> = {
  reels: "bg-pink-100 text-pink-700",
  feed: "bg-blue-100 text-blue-800",
  carrossel: "bg-violet-100 text-violet-700",
  stories: "bg-amber-100 text-amber-800",
};

export default function PautasPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<string>("todas");
  const [status, setStatus] = useState<string>("nova");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setIdeas(await listContentIdeas(supabase));
    } catch (e) {
      toast.error("Não foi possível carregar as pautas.");
      console.error(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Abrir a aba = "li as pautas": apaga a bolinha da sidebar e o aviso do sininho.
  useEffect(() => {
    if (profile) markIdeasSeen(supabase, profile.id).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useRealtimeChanges(["content_ideas"], load);

  const filtered = useMemo(
    () => ideas.filter((i) => (account === "todas" || i.account === account) && (status === "todas" || i.status === status)),
    [ideas, account, status]
  );

  // Agrupa por lote (dia + período), mais recente primeiro.
  const batches = useMemo(() => {
    const map = new Map<string, ContentIdea[]>();
    for (const i of filtered) {
      const k = `${i.batch_date}|${i.period}`;
      map.set(k, [...(map.get(k) ?? []), i]);
    }
    return [...map.entries()];
  }, [filtered]);

  async function run(id: string, fn: () => Promise<ContentIdea>, msg: string) {
    if (!profile) return;
    setBusy(id);
    try {
      const updated = await fn();
      setIdeas((prev) => prev.map((i) => (i.id === id ? updated : i)));
      toast.success(msg);
    } catch (e) {
      toast.error("Algo deu errado. Tente de novo.");
      console.error(e);
    } finally {
      setBusy(null);
    }
  }

  const countOf = (s: string) => ideas.filter((i) => i.status === s).length;

  return (
    <div>
      <PageHeader
        icon={Lightbulb}
        title="Pautas do Dia"
        description="Todo dia às 7h30 e 13h30 o Helpinho cruza as notícias de trânsito do dia com o que mais performou no nosso Instagram e sugere conteúdos prontos."
      />

      <RadarRunPanel onFinished={load} />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs
          tabs={[
            { key: "todas", label: "Todas as contas" },
            { key: "franchising", label: "Franchising" },
            { key: "roberson", label: "Roberson" },
          ]}
          active={account}
          onChange={setAccount}
        />
        <Tabs
          tabs={[
            { key: "nova", label: "Novas", count: countOf("nova") },
            { key: "aprovada", label: "Aprovadas", count: countOf("aprovada") },
            { key: "descartada", label: "Descartadas", count: countOf("descartada") },
            { key: "todas", label: "Todas", count: ideas.length },
          ]}
          active={status}
          onChange={setStatus}
        />
      </div>

      {!loading && batches.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nenhuma pauta por aqui"
          description="As ideias aparecem aqui quando o Radar de Pauta roda (7h30 e 13h30) ou quando alguém clica em Gerar pautas agora."
        />
      ) : (
        <div className="space-y-8">
          {batches.map(([key, list]) => {
            const [date, period] = key.split("|");
            return (
              <section key={key}>
                <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-gray-500">
                  {format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: ptBR })} · {period === "tarde" ? "Tarde" : "Manhã"}
                </h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {list.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      busy={busy === idea.id}
                      onApprove={() => run(idea.id, () => approveIdeaAsTask(supabase, idea, profile!.id), "Pauta aprovada — tarefa criada!")}
                      onTeleprompter={() => run(idea.id, () => sendIdeaToTeleprompter(supabase, idea, profile!.id), "Roteiro enviado ao Teleprompter!")}
                      onDiscard={() => run(idea.id, () => discardIdea(supabase, idea.id, profile!.id), "Pauta descartada.")}
                      onReopen={() => run(idea.id, () => reopenIdea(supabase, idea.id, profile!.id), "Pauta voltou para Novas.")}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IdeaCard({
  idea, busy, onApprove, onTeleprompter, onDiscard, onReopen,
}: {
  idea: ContentIdea;
  busy: boolean;
  onApprove: () => void;
  onTeleprompter: () => void;
  onDiscard: () => void;
  onReopen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isVideo = idea.format === "reels" || idea.format === "stories";
  return (
    <article className={cn("flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-[var(--shadow-sm)]", idea.status === "descartada" && "opacity-60")}>
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
        <span className={cn("rounded-full px-2 py-0.5", FORMAT_COLOR[idea.format])}>{FORMAT_LABEL[idea.format]}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{ACCOUNT_LABEL[idea.account]}</span>
        {idea.score != null && <span className="ml-auto rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-800">🔥 {idea.score}</span>}
      </div>

      <h3 className="font-display text-base font-bold leading-snug text-blue-900">{idea.title}</h3>
      {idea.hook && <p className="mt-1.5 text-sm font-semibold text-gray-800">“{idea.hook}”</p>}
      {idea.why && <p className="mt-2 text-xs text-gray-500">💡 {idea.why}</p>}

      {(idea.script || idea.caption) && (
        <button type="button" onClick={() => setOpen(true)} className="mt-3 self-start text-xs font-bold text-blue-800 hover:underline">
          Ver roteiro e legenda
        </button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} size="lg">
        <DialogHeader title={idea.title} onClose={() => setOpen(false)} />
        <DialogBody className="space-y-5 text-sm text-gray-800">
          {idea.hook && (
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase text-gray-500">Gancho</p>
              <p className="font-semibold">“{idea.hook}”</p>
            </div>
          )}
          {idea.script && (
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase text-gray-500">Roteiro</p>
              <p className="whitespace-pre-line rounded-xl bg-gray-050 p-3 leading-relaxed">{idea.script}</p>
            </div>
          )}
          {idea.caption && (
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase text-gray-500">Legenda</p>
              <p className="whitespace-pre-line rounded-xl bg-gray-050 p-3 leading-relaxed">{idea.caption}</p>
            </div>
          )}
          {idea.cta && (
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase text-gray-500">CTA</p>
              <p>{idea.cta}</p>
            </div>
          )}
        </DialogBody>
      </Dialog>

      <div className="mt-3 space-y-1 text-xs">
        {idea.source_url && (
          <a href={idea.source_url} target="_blank" rel="noreferrer" className="flex items-start gap-1.5 text-gray-600 hover:text-blue-800">
            <Newspaper className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">{idea.source_title ?? idea.source_url}{idea.source_name ? ` — ${idea.source_name}` : ""}</span>
          </a>
        )}
        {idea.reference_permalink && (
          <a href={idea.reference_permalink} target="_blank" rel="noreferrer" className="flex items-start gap-1.5 text-gray-600 hover:text-blue-800">
            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">Referência{idea.reference_note ? `: ${idea.reference_note}` : ""}</span>
          </a>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {idea.status === "nova" ? (
          <>
            <Button size="sm" onClick={onApprove} disabled={busy} className="gap-1"><Check className="h-4 w-4" /> Virar tarefa</Button>
            {isVideo && (
              <Button size="sm" variant="secondary" onClick={onTeleprompter} disabled={busy} className="gap-1"><Mic className="h-4 w-4" /> Teleprompter</Button>
            )}
            <Button size="sm" variant="ghost" onClick={onDiscard} disabled={busy} className="gap-1"><X className="h-4 w-4" /> Descartar</Button>
          </>
        ) : (
          <>
            {(idea.task_id || idea.teleprompter_script_id) && (
              <div className="flex basis-full flex-wrap gap-x-4 gap-y-1">
                {idea.task_id && <Link href={`/tasks/${idea.task_id}`} className="text-xs font-bold text-blue-800 hover:underline">Abrir tarefa →</Link>}
                {idea.teleprompter_script_id && <Link href="/teleprompter" className="text-xs font-bold text-blue-800 hover:underline">Abrir no Teleprompter →</Link>}
              </div>
            )}
            {idea.status === "aprovada" && isVideo && !idea.teleprompter_script_id && (
              <Button size="sm" variant="secondary" onClick={onTeleprompter} disabled={busy} className="gap-1"><Mic className="h-4 w-4" /> Teleprompter</Button>
            )}
            <Button size="sm" variant="ghost" onClick={onReopen} disabled={busy} className="gap-1"><RotateCcw className="h-4 w-4" /> Voltar</Button>
          </>
        )}
      </div>
    </article>
  );
}
