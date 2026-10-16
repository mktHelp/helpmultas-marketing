"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Layers, Lightbulb, Sparkles, Trophy } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RightDrawer } from "@/components/shared/RightDrawer";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { RadarRunPanel } from "@/components/pautas/RadarRunPanel";
import { IdeaBadges, IdeaCard, ScorePill, SourceLine } from "@/components/pautas/IdeaCard";
import { IdeaDrawer } from "@/components/pautas/IdeaDrawer";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { listProfiles } from "@/lib/services/profiles";
import {
  approveIdeaAsTask, discardIdea, listContentIdeas, markIdeasSeen, reopenIdea, requestIdeaVariation, sendIdeaToTeleprompter,
} from "@/lib/services/contentIdeas";
import type { ContentIdea, Profile } from "@/types/database";

type Group = { theme: string | null; ideas: ContentIdea[] };

/** Junta as pautas de um lote por tema: temas com 2+ pautas viram um grupo; o resto fica solto. */
function groupByTheme(list: ContentIdea[]): Group[] {
  const map = new Map<string, ContentIdea[]>();
  for (const i of list) {
    const k = i.theme?.trim().toLowerCase() || `__${i.id}`;
    map.set(k, [...(map.get(k) ?? []), i]);
  }
  const groups: Group[] = [];
  const loose: ContentIdea[] = [];
  for (const ideas of map.values()) {
    if (ideas.length >= 2) groups.push({ theme: ideas[0].theme, ideas });
    else loose.push(ideas[0]);
  }
  groups.sort((a, b) => (b.ideas[0].score ?? 0) - (a.ideas[0].score ?? 0));
  return loose.length ? [...groups, { theme: null, ideas: loose }] : groups;
}

export default function PautasPage() {
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useAuth();
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<string>("todas");
  const [status, setStatus] = useState<string>("nova");
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setIdeas(await listContentIdeas(supabase));
    } catch (e) {
      toast.error("Não foi possível carregar as pautas.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
    listProfiles(supabase).then(setProfiles).catch(() => {});
  }, [load, supabase]);

  // Abrir a aba = "li as pautas": apaga a bolinha da sidebar e o aviso do sininho.
  useEffect(() => {
    if (profile) markIdeasSeen(supabase, profile.id).catch(() => {});
  }, [profile, supabase]);

  useRealtimeChanges(["content_ideas"], load);

  const filtered = useMemo(
    () =>
      ideas
        .filter((i) => (account === "todas" || i.account === account) && (status === "todas" || i.status === status))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [ideas, account, status]
  );

  // Lotes (dia + período), mais recente primeiro.
  const batches = useMemo(() => {
    const map = new Map<string, ContentIdea[]>();
    for (const i of filtered) {
      const k = `${i.batch_date}|${i.period}`;
      map.set(k, [...(map.get(k) ?? []), i]);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  // Destaque do dia: a pauta nova de maior nota do lote mais recente.
  const featured = useMemo(() => {
    if (status !== "nova" && status !== "todas") return null;
    const first = batches[0]?.[1] ?? [];
    return first.find((i) => i.status === "nova") ?? null;
  }, [batches, status]);

  const openIdea = ideas.find((i) => i.id === openId) ?? null;

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

  async function variation(idea: ContentIdea) {
    setBusy(idea.id);
    try {
      const created = await requestIdeaVariation(idea.id);
      setIdeas((prev) => [created, ...prev]);
      setOpenId(created.id);
      toast.success("Variação criada!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a variação.");
    } finally {
      setBusy(null);
    }
  }

  const countOf = (s: string) => ideas.filter((i) => i.status === s).length;
  // Contagem por conta respeita a aba de status ativa, para bater com o que aparece na lista.
  const accountCount = (a: string) =>
    ideas.filter((i) => (a === "todas" || i.account === a) && (status === "todas" || i.status === status)).length;

  return (
    <div>
      <PageHeader
        icon={Lightbulb}
        title="Pautas do Dia"
        description="Todo dia às 7h30 e 13h30 o Helpinho cruza as notícias de trânsito mais recentes com o que mais performou no nosso Instagram e sugere conteúdos prontos."
      />

      <RadarRunPanel onFinished={load} />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs
          tabs={[
            { key: "todas", label: "Todas as contas", count: accountCount("todas") },
            { key: "franchising", label: "Franchising", count: accountCount("franchising") },
            { key: "roberson", label: "Roberson", count: accountCount("roberson") },
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

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Carregando pautas">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="ast-skeleton h-40 rounded-2xl" style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      ) : batches.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nenhuma pauta por aqui"
          description="As ideias aparecem aqui quando o Radar de Pauta roda (7h30 e 13h30) ou quando alguém clica em Gerar pautas agora."
        />
      ) : (
        <div className="space-y-8">
          {featured && <FeaturedIdea idea={featured} onOpen={() => setOpenId(featured.id)} />}

          {batches.map(([key, list]) => {
            const [date, period] = key.split("|");
            const rest = list.filter((i) => i.id !== featured?.id);
            if (rest.length === 0) return null;
            return (
              <section key={key}>
                <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-gray-500">
                  {format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: ptBR })} · {period === "tarde" ? "Tarde" : "Manhã"}
                </h2>
                <div className="space-y-5">
                  {groupByTheme(rest).map((g) => (
                    <div key={g.theme ?? "soltas"}>
                      {g.theme && (
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-blue-800">
                          <Layers className="h-3.5 w-3.5" /> {g.ideas.length} ângulos sobre “{g.theme}”
                        </p>
                      )}
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {g.ideas.map((idea, i) => (
                          <IdeaCard key={idea.id} idea={idea} index={i} onOpen={() => setOpenId(idea.id)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <RightDrawer open={!!openIdea} onClose={() => setOpenId(null)} label="Detalhes da pauta" wide>
        {openIdea && profile && (
          <IdeaDrawer
            idea={openIdea}
            busy={busy === openIdea.id}
            profiles={profiles}
            onClose={() => setOpenId(null)}
            actions={{
              onApprove: (opts) =>
                run(openIdea.id, () => approveIdeaAsTask(supabase, openIdea, profile.id, opts), opts?.dueDate ? "Tarefa agendada no calendário!" : "Pauta aprovada: tarefa criada!"),
              onTeleprompter: () => run(openIdea.id, () => sendIdeaToTeleprompter(supabase, openIdea, profile.id), "Roteiro enviado ao Teleprompter!"),
              onDiscard: () => run(openIdea.id, () => discardIdea(supabase, openIdea.id, profile.id), "Pauta descartada."),
              onReopen: () => run(openIdea.id, () => reopenIdea(supabase, openIdea.id, profile.id), "Pauta voltou para Novas."),
              onVariation: () => variation(openIdea),
            }}
          />
        )}
      </RightDrawer>
    </div>
  );
}

function FeaturedIdea({ idea, onOpen }: { idea: ContentIdea; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="ast-fade-up block w-full overflow-hidden rounded-3xl border border-yellow-200 bg-gradient-to-br from-yellow-050 via-white to-white text-left shadow-[var(--shadow-md)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)]"
    >
      <div className="grid gap-5 p-5 lg:grid-cols-[1.2fr_1fr] lg:p-6">
        <div className="min-w-0">
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-blue-900 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-yellow-500">
            <Trophy className="h-3.5 w-3.5" /> Destaque do dia
          </p>
          <div className="flex items-start gap-3">
            <h2 className="min-w-0 flex-1 font-display text-xl font-bold leading-snug text-blue-900 sm:text-2xl">{idea.title}</h2>
            <ScorePill score={idea.score} big />
          </div>
          <div className="mt-2">
            <IdeaBadges idea={idea} />
          </div>
          {idea.hook && <p className="mt-3 font-display text-base font-semibold text-gray-800">“{idea.hook}”</p>}
          {idea.why && <p className="mt-2 text-sm text-gray-600">💡 {idea.why}</p>}
          <SourceLine idea={idea} className="mt-3" />
        </div>
        {idea.script && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Roteiro</p>
            <p className="line-clamp-[9] whitespace-pre-line text-sm leading-relaxed text-gray-700">{idea.script}</p>
            <p className="mt-2 text-xs font-bold text-blue-800">Abrir pauta completa →</p>
          </div>
        )}
      </div>
    </button>
  );
}
