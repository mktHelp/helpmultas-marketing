"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, Coins, Cpu, Lightbulb, Newspaper, SlidersHorizontal } from "lucide-react";
import { RightDrawer } from "@/components/shared/RightDrawer";
import { RadarSettingsDrawer } from "./RadarSettingsDrawer";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { RADAR_EFFORTS, getRadarSettings, listRecentRuns } from "@/lib/services/contentIdeas";
import type { ContentIdea, ContentIdeaRun, ContentRadarSettings } from "@/types/database";
import { cn } from "@/lib/utils";

// valores pequenos (custo por pauta) precisam de mais casas para não aparecer como $0.00
const usd = { format: (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: v > 0 && v < 0.1 ? 4 : 2 })}` };
const int = new Intl.NumberFormat("pt-BR");
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function Card({ icon: Icon, label, value, hint, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string; color: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 shadow-[var(--shadow-sm)]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: color }}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
        <p className="mt-0.5 font-display text-lg font-bold text-blue-900">{value}</p>
        {hint && <p className="mt-0.5 truncate text-[11px] text-gray-500">{hint}</p>}
      </div>
    </div>
  );
}

/** Gasto e números do Radar de Pauta: execuções, pautas, aproveitamento, tokens e custo da IA. */
export function AiUsagePanel({ ideas }: { ideas: ContentIdea[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [runs, setRuns] = useState<ContentIdeaRun[]>([]);
  const [days, setDays] = useState<7 | 30>(30);
  const [now, setNow] = useState(() => Date.now());
  const { profile, isManager } = useAuth();
  const [settings, setSettings] = useState<ContentRadarSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(() => {
    listRecentRuns(supabase, 30)
      .then((r) => {
        setRuns(r);
        setNow(Date.now());
      })
      .catch(() => {});
  }, [supabase]);

  useEffect(() => {
    load();
    getRadarSettings(supabase).then(setSettings).catch(() => {});
  }, [load, supabase]);

  useRealtimeChanges(["content_idea_runs"], load);

  const s = useMemo(() => {
    const since = now - days * 864e5;
    const list = runs.filter((r) => new Date(r.started_at).getTime() >= since);
    const done = list.filter((r) => r.status === "done");
    const errors = list.filter((r) => r.status === "error").length;
    const withCost = done.filter((r) => r.cost_usd != null);
    const cost = withCost.reduce((a, r) => a + Number(r.cost_usd), 0);
    const tokensIn = done.reduce((a, r) => a + (r.prompt_tokens ?? 0), 0);
    const tokensOut = done.reduce((a, r) => a + (r.completion_tokens ?? 0), 0);
    const generated = done.reduce((a, r) => a + (r.ideas_count ?? 0), 0);
    const news = done.reduce((a, r) => a + (r.news_count ?? 0), 0);
    // a aba carrega só as pautas dos últimos 7 dias, então o aproveitamento é sempre desse período
    const recentIdeas = ideas.filter((i) => !i.variation_of);
    const decided = recentIdeas.filter((i) => i.status !== "nova");
    const approved = recentIdeas.filter((i) => i.status === "aprovada").length;
    const model = done.find((r) => r.model)?.model ?? null;
    return {
      runs: list.length, done: done.length, errors, cost, withCost: withCost.length,
      perRun: withCost.length ? cost / withCost.length : 0,
      perIdea: generated && withCost.length ? cost / generated : 0,
      tokensIn, tokensOut, generated, news, approved, decided: decided.length, model,
      // projeção do mês: média por dia desde a primeira execução com custo (mínimo 1 dia) × 30
      monthly: withCost.length ? (cost / Math.min(days, Math.max(1, (now - Math.min(...withCost.map((r) => new Date(r.started_at).getTime()))) / 864e5))) * 30 : 0,
    };
  }, [runs, ideas, days, now]);

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-bold text-blue-900">
          <Bot className="h-4 w-4 text-blue-700" /> Uso da IA
        </h2>
        {(settings?.model ?? s.model) && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600">
            {settings?.model ?? s.model}
            {settings && settings.reasoning_effort !== "padrao" && ` · esforço ${RADAR_EFFORTS.find((e) => e.id === settings.reasoning_effort)?.label.toLowerCase()}`}
          </span>
        )}
        {settings && (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-[11px] font-bold text-blue-900 hover:bg-gray-050"
          >
            <SlidersHorizontal className="h-3 w-3" /> Ajustes
          </button>
        )}
        <div className="ml-auto inline-flex rounded-full border border-gray-200 bg-white p-0.5">
          {([7, 30] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", days === d ? "bg-blue-900 text-white" : "text-gray-500 hover:bg-gray-050")}
            >
              {d} dias
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Card
          icon={Coins}
          label="Custo"
          value={usd.format(s.cost)}
          hint={s.withCost ? `≈ ${usd.format(s.monthly)}/mês no ritmo atual` : "sem dados ainda"}
          color="#2f8f5b"
        />
        <Card icon={Coins} label="Por execução" value={usd.format(s.perRun)} hint={s.perIdea ? `${usd.format(s.perIdea)} por pauta` : undefined} color="#1a9a9a" />
        <Card
          icon={Bot}
          label="Execuções"
          value={int.format(s.runs)}
          hint={`${s.done} ok${s.errors ? ` · ${s.errors} com erro` : ""}`}
          color="#375367"
        />
        <Card icon={Lightbulb} label="Pautas geradas" value={int.format(s.generated)} hint={s.news ? `a partir de ${int.format(s.news)} notícias` : undefined} color="#e0a900" />
        <Card
          icon={CheckCircle2}
          label="Aproveitamento"
          value={s.decided ? `${Math.round((s.approved / s.decided) * 100)}%` : "—"}
          hint={s.decided ? `${s.approved} de ${s.decided} avaliadas (7 dias)` : "nenhuma pauta avaliada"}
          color="#6b4bb8"
        />
        <Card
          icon={Cpu}
          label="Tokens"
          value={compact.format(s.tokensIn + s.tokensOut)}
          hint={`${compact.format(s.tokensIn)} entrada · ${compact.format(s.tokensOut)} saída`}
          color="#4a6a80"
        />
      </div>
      {s.done > 0 && s.withCost === 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500">
          <Newspaper className="h-3.5 w-3.5" /> O custo aparece a partir das execuções feitas com o workflow novo do n8n.
        </p>
      )}
      <RightDrawer open={settingsOpen && !!settings} onClose={() => setSettingsOpen(false)} label="Ajustes da IA">
        {settings && profile && (
          <RadarSettingsDrawer settings={settings} userId={profile.id} canEdit={isManager} onSaved={setSettings} onClose={() => setSettingsOpen(false)} />
        )}
      </RightDrawer>
    </section>
  );
}
