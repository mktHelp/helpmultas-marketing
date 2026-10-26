"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO, startOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, Bot, Clock, Coins, Cpu, Gauge, Lightbulb, MessageSquare, RefreshCw, SlidersHorizontal, TrendingUp, Zap,
} from "lucide-react";
import { RightDrawer } from "@/components/shared/RightDrawer";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/Button";
import { RadarSettingsDrawer } from "@/components/pautas/RadarSettingsDrawer";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getRadarSettings, RADAR_EFFORTS } from "@/lib/services/contentIdeas";
import { listProfiles } from "@/lib/services/profiles";
import { AXIS_PROPS, BAR_MAX, CURSOR_STYLE, GRID_PROPS, TOOLTIP_STYLE } from "@/lib/chart-theme";
import type { ContentIdeaRun, ContentRadarSettings, Profile } from "@/types/database";
import { cn } from "@/lib/utils";

type Source = "helpinho" | "radar" | "teleprompter" | "pauta_variacao" | "expansao_categoria" | "expansao_importar";

interface Ev {
  source: Source;
  user_id: string | null;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number | null;
  estimated: boolean;
  tool_calls: number | null;
  duration_ms: number | null;
  ok: boolean;
  error: string | null;
  created_at: string;
}

const SOURCES: Record<Source, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  helpinho: { label: "Helpinho (chat)", color: "#243746", icon: MessageSquare },
  radar: { label: "Radar de Pauta", color: "#e0a900", icon: Lightbulb },
  teleprompter: { label: "Teleprompter", color: "#6b8cae", icon: Bot },
  pauta_variacao: { label: "Variação de pauta", color: "#2f8f5b", icon: Zap },
  expansao_categoria: { label: "Expansão (categorias)", color: "#e07a2f", icon: TrendingUp },
  expansao_importar: { label: "Expansão (importar arquivos)", color: "#8b5cf6", icon: TrendingUp },
};
const SOURCE_KEYS = Object.keys(SOURCES) as Source[];

const money = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: v > 0 && v < 0.1 ? 4 : 2 })}`;
const int = new Intl.NumberFormat("pt-BR");
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const secs = (ms: number) => (ms >= 10000 ? `${Math.round(ms / 1000)}s` : `${(ms / 1000).toFixed(1)}s`);

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function Kpi({ icon: Icon, label, value, hint, color, alert }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string; color: string; alert?: boolean }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border bg-white p-3.5 shadow-[var(--shadow-sm)]", alert ? "border-red-200" : "border-gray-200")}>
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

function Panel({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-gray-200 bg-white p-4", className)}>
      <p className="font-display text-sm font-bold text-blue-900">{title}</p>
      {subtitle && <p className="mb-3 text-[11px] text-gray-500">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

/** Painel do Master: custo, uso, desempenho e erros de todas as IAs do Hub. */
export function AiUsageSettings() {
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useAuth();
  const [events, setEvents] = useState<Ev[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [settings, setSettings] = useState<ContentRadarSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    const since = subDays(new Date(), 90).toISOString();
    const [usage, runs] = await Promise.all([
      supabase
        .from("ai_usage_events")
        .select("source, user_id, model, prompt_tokens, completion_tokens, cost_usd, estimated, tool_calls, duration_ms, ok, error, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10000),
      supabase.from("content_idea_runs").select("*").gte("started_at", since).order("started_at", { ascending: false }),
    ]);
    setMissingTable(!!usage.error);
    const fromUsage: Ev[] = (usage.data ?? []).map((r) => ({
      source: r.source as Source,
      user_id: r.user_id,
      model: r.model,
      prompt_tokens: r.prompt_tokens ?? 0,
      completion_tokens: r.completion_tokens ?? 0,
      cost: r.cost_usd == null ? null : Number(r.cost_usd),
      estimated: r.estimated,
      tool_calls: r.tool_calls,
      duration_ms: r.duration_ms,
      ok: r.ok,
      error: r.error,
      created_at: r.created_at,
    }));
    const fromRuns: Ev[] = ((runs.data ?? []) as ContentIdeaRun[])
      .filter((r) => r.status !== "running")
      .map((r) => ({
        source: "radar",
        user_id: r.triggered_by,
        model: r.model,
        prompt_tokens: r.prompt_tokens ?? 0,
        completion_tokens: r.completion_tokens ?? 0,
        cost: r.cost_usd == null ? null : Number(r.cost_usd),
        estimated: false,
        tool_calls: null,
        duration_ms: r.finished_at ? new Date(r.finished_at).getTime() - new Date(r.started_at).getTime() : null,
        ok: r.status === "done",
        error: r.error_message,
        created_at: r.started_at,
      }));
    setEvents([...fromUsage, ...fromRuns].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
    setNow(Date.now());
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    listProfiles(supabase).then(setProfiles).catch(() => {});
    getRadarSettings(supabase).then(setSettings).catch(() => {});
  }, [load, supabase]);

  const nameOf = useCallback((id: string | null) => (id ? profiles.find((p) => p.id === id) : undefined), [profiles]);

  const d = useMemo(() => {
    const since = now - days * 864e5;
    const list = events.filter((e) => new Date(e.created_at).getTime() >= since);
    const ok = list.filter((e) => e.ok);
    const errors = list.filter((e) => !e.ok);
    const withCost = list.filter((e) => e.cost != null);
    const cost = withCost.reduce((a, e) => a + (e.cost ?? 0), 0);
    const tokIn = list.reduce((a, e) => a + e.prompt_tokens, 0);
    const tokOut = list.reduce((a, e) => a + e.completion_tokens, 0);
    const durations = ok.filter((e) => e.duration_ms != null && e.source !== "radar").map((e) => e.duration_ms!);
    const firstCost = withCost.length ? Math.min(...withCost.map((e) => new Date(e.created_at).getTime())) : now;
    const spanDays = Math.min(days, Math.max(1, (now - firstCost) / 864e5));
    const estimated = list.filter((e) => e.estimated).length;
    const noTokens = ok.filter((e) => !e.prompt_tokens && !e.completion_tokens).length;

    // série diária, empilhada por fonte
    const daily = new Map<string, Record<string, number | string>>();
    for (let i = days - 1; i >= 0; i--) {
      const key = format(subDays(startOfDay(new Date(now)), i), "yyyy-MM-dd");
      daily.set(key, { day: key, tokIn: 0, tokOut: 0, calls: 0, ...Object.fromEntries(SOURCE_KEYS.map((s) => [s, 0])) });
    }
    for (const e of list) {
      const row = daily.get(format(parseISO(e.created_at), "yyyy-MM-dd"));
      if (!row) continue;
      row[e.source] = (row[e.source] as number) + (e.cost ?? 0);
      row.tokIn = (row.tokIn as number) + e.prompt_tokens;
      row.tokOut = (row.tokOut as number) + e.completion_tokens;
      row.calls = (row.calls as number) + 1;
    }

    const bySource = SOURCE_KEYS.map((s) => {
      const l = list.filter((e) => e.source === s);
      const c = l.reduce((a, e) => a + (e.cost ?? 0), 0);
      const dur = l.filter((e) => e.ok && e.duration_ms != null).map((e) => e.duration_ms!);
      return {
        source: s,
        calls: l.length,
        errors: l.filter((e) => !e.ok).length,
        cost: c,
        tokens: l.reduce((a, e) => a + e.prompt_tokens + e.completion_tokens, 0),
        avgMs: dur.length ? dur.reduce((a, v) => a + v, 0) / dur.length : 0,
        perCall: l.length ? c / l.length : 0,
      };
    }).filter((r) => r.calls > 0).sort((a, b) => b.cost - a.cost || b.calls - a.calls);

    const userMap = new Map<string, { calls: number; cost: number; tokens: number }>();
    for (const e of list) {
      const k = e.user_id ?? "__sistema";
      const u = userMap.get(k) ?? { calls: 0, cost: 0, tokens: 0 };
      u.calls++;
      u.cost += e.cost ?? 0;
      u.tokens += e.prompt_tokens + e.completion_tokens;
      userMap.set(k, u);
    }
    const byUser = [...userMap.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.cost - a.cost || b.calls - a.calls).slice(0, 8);

    const modelMap = new Map<string, { calls: number; cost: number; tokens: number }>();
    for (const e of list) {
      const k = e.model ?? "desconhecido";
      const m = modelMap.get(k) ?? { calls: 0, cost: 0, tokens: 0 };
      m.calls++;
      m.cost += e.cost ?? 0;
      m.tokens += e.prompt_tokens + e.completion_tokens;
      modelMap.set(k, m);
    }
    const byModel = [...modelMap.entries()].map(([model, v]) => ({ model, ...v })).sort((a, b) => b.calls - a.calls);

    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}h`, calls: 0 }));
    for (const e of list) hours[parseISO(e.created_at).getHours()].calls++;

    const toolCalls = list.filter((e) => e.tool_calls != null);

    return {
      list, ok, errors, cost, tokIn, tokOut, estimated, noTokens,
      monthly: withCost.length ? (cost / spanDays) * 30 : 0,
      perCall: withCost.length ? cost / withCost.length : 0,
      avgMs: durations.length ? durations.reduce((a, v) => a + v, 0) / durations.length : 0,
      p95Ms: percentile(durations, 95),
      avgTools: toolCalls.length ? toolCalls.reduce((a, e) => a + (e.tool_calls ?? 0), 0) / toolCalls.length : null,
      daily: [...daily.values()],
      bySource, byUser, byModel, hours,
      recentErrors: errors.slice(0, 8),
      users: new Set(list.map((e) => e.user_id).filter(Boolean)).size,
    };
  }, [events, days, now]);

  const errorRate = d.list.length ? (d.errors.length / d.list.length) * 100 : 0;
  const tickDay = (v: string) => format(parseISO(v), days > 30 ? "dd/MM" : "dd", { locale: ptBR });

  return (
    <div className="space-y-5">
      {/* barra de controle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-gray-200 bg-white p-0.5">
          {([7, 30, 90] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setDays(n)}
              aria-pressed={days === n}
              className={cn("rounded-full px-3 py-1 text-xs font-bold", days === n ? "bg-blue-900 text-white" : "text-gray-500 hover:bg-gray-050")}
            >
              {n} dias
            </button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="gap-1">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Atualizar
        </Button>
        {settings && (
          <Button size="sm" onClick={() => setSettingsOpen(true)} className="ml-auto gap-1.5 !bg-blue-900 !text-yellow-500 hover:!bg-blue-800">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Ajustes do Radar
            <span className="font-normal text-blue-100">
              · {settings.model}
              {settings.reasoning_effort !== "padrao" && ` · ${RADAR_EFFORTS.find((e) => e.id === settings.reasoning_effort)?.label.toLowerCase()}`}
            </span>
          </Button>
        )}
      </div>

      {missingTable && (
        <p className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          A tabela ai_usage_events ainda não existe. Rode a migração 0075 no Supabase; por enquanto só aparecem os dados do Radar de Pauta.
        </p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={Coins} label="Custo no período" value={money(d.cost)} hint={`≈ ${money(d.monthly)}/mês no ritmo atual`} color="#2f8f5b" />
        <Kpi icon={Zap} label="Chamadas" value={int.format(d.list.length)} hint={`${d.users} ${d.users === 1 ? "pessoa" : "pessoas"} · ${money(d.perCall)} por chamada`} color="#243746" />
        <Kpi icon={Cpu} label="Tokens" value={compact.format(d.tokIn + d.tokOut)} hint={`${compact.format(d.tokIn)} entrada · ${compact.format(d.tokOut)} saída`} color="#4a6a80" />
        <Kpi
          icon={AlertTriangle}
          label="Taxa de erro"
          value={`${errorRate.toFixed(errorRate < 10 && errorRate > 0 ? 1 : 0)}%`}
          hint={`${d.errors.length} de ${d.list.length} chamadas`}
          color={errorRate > 5 ? "#c23b3b" : "#7c8e98"}
          alert={errorRate > 5}
        />
        <Kpi icon={Clock} label="Tempo de resposta" value={d.avgMs ? secs(d.avgMs) : "—"} hint={d.p95Ms ? `p95 ${secs(d.p95Ms)} (sem o Radar)` : "média das chamadas ok"} color="#6b4bb8" />
        <Kpi icon={Gauge} label="Ferramentas por resposta" value={d.avgTools == null ? "—" : d.avgTools.toFixed(1)} hint="média de consultas do agente ao banco" color="#1a9a9a" />
        <Kpi icon={TrendingUp} label="Saída / entrada" value={d.tokIn ? `${((d.tokOut / d.tokIn) * 100).toFixed(0)}%` : "—"} hint="quanto a IA escreve vs. lê" color="#e07a2f" />
        <Kpi
          icon={Cpu}
          label="Sem tokens medidos"
          value={int.format(d.noTokens)}
          hint={d.estimated ? `${d.estimated} com tokens estimados` : "chamadas ok sem dado de tokens"}
          color="#a9b8c3"
        />
      </div>

      {/* gráficos */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Custo por dia" subtitle="Empilhado por origem (US$)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.daily}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="day" {...AXIS_PROPS} tickFormatter={tickDay} minTickGap={12} />
                <YAxis {...AXIS_PROPS} width={52} tickFormatter={(v: number) => `$${v.toFixed(v < 1 ? 2 : 0)}`} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={CURSOR_STYLE}
                  labelFormatter={(v) => format(parseISO(String(v)), "dd 'de' MMM", { locale: ptBR })}
                  formatter={(v, n) => [money(Number(v)), SOURCES[n as Source]?.label ?? n]}
                />
                {SOURCE_KEYS.map((s) => (
                  <Bar key={s} dataKey={s} stackId="c" fill={SOURCES[s].color} maxBarSize={BAR_MAX} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Tokens por dia" subtitle="Entrada (o que a IA lê) e saída (o que escreve)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.daily}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="day" {...AXIS_PROPS} tickFormatter={tickDay} minTickGap={12} />
                <YAxis {...AXIS_PROPS} width={48} tickFormatter={(v: number) => compact.format(v)} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(v) => format(parseISO(String(v)), "dd 'de' MMM", { locale: ptBR })}
                  formatter={(v, n) => [int.format(Number(v)), n === "tokIn" ? "Entrada" : "Saída"]}
                />
                <Legend formatter={(v) => (v === "tokIn" ? "Entrada" : "Saída")} wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="tokIn" stackId="t" stroke="#6b8cae" fill="#6b8cae" fillOpacity={0.25} />
                <Area type="monotone" dataKey="tokOut" stackId="t" stroke="#e0a900" fill="#e0a900" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Por origem" subtitle="Onde a IA é usada e quanto custa cada uma">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-xs">
              <thead className="text-left text-[11px] uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="pb-2 font-bold">Origem</th>
                  <th className="pb-2 text-right font-bold">Chamadas</th>
                  <th className="pb-2 text-right font-bold">Custo</th>
                  <th className="pb-2 text-right font-bold">Por chamada</th>
                  <th className="pb-2 text-right font-bold">Tempo médio</th>
                  <th className="pb-2 text-right font-bold">Erros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {d.bySource.map((r) => {
                  const S = SOURCES[r.source];
                  return (
                    <tr key={r.source}>
                      <td className="py-2">
                        <span className="inline-flex items-center gap-2 font-semibold text-blue-900">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: S.color }} /> {S.label}
                        </span>
                      </td>
                      <td className="py-2 text-right">{int.format(r.calls)}</td>
                      <td className="py-2 text-right font-semibold">{money(r.cost)}</td>
                      <td className="py-2 text-right">{money(r.perCall)}</td>
                      <td className="py-2 text-right">{r.avgMs ? secs(r.avgMs) : "—"}</td>
                      <td className={cn("py-2 text-right", r.errors && "font-bold text-red-600")}>{r.errors}</td>
                    </tr>
                  );
                })}
                {d.bySource.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-gray-400">Nenhuma chamada no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Horário de uso" subtitle="Chamadas por hora do dia">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.hours}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="hour" {...AXIS_PROPS} interval={2} />
                <YAxis {...AXIS_PROPS} width={32} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={CURSOR_STYLE} formatter={(v) => [int.format(Number(v)), "Chamadas"]} />
                <Bar dataKey="calls" fill="#243746" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Quem mais usa" subtitle="Ordenado por custo">
          <ul className="space-y-2">
            {d.byUser.map((u) => {
              const p = u.id === "__sistema" ? undefined : nameOf(u.id);
              const max = d.byUser[0]?.cost || d.byUser[0]?.calls || 1;
              const share = (d.byUser[0]?.cost ? u.cost : u.calls) / max;
              return (
                <li key={u.id} className="flex items-center gap-2.5 text-xs">
                  {p ? <UserAvatar name={p.full_name} avatarUrl={p.avatar_url} size="xs" /> : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100"><Bot className="h-3.5 w-3.5 text-gray-500" /></span>}
                  <span className="w-32 shrink-0 truncate font-semibold text-blue-900">{p?.full_name ?? (u.id === "__sistema" ? "Agendado (sistema)" : "Usuário removido")}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <span className="block h-full rounded-full bg-yellow-500" style={{ width: `${Math.max(4, share * 100)}%` }} />
                  </span>
                  <span className="w-28 shrink-0 text-right text-gray-600">{int.format(u.calls)} · <b className="text-blue-900">{money(u.cost)}</b></span>
                </li>
              );
            })}
            {d.byUser.length === 0 && <p className="py-6 text-center text-xs text-gray-400">Sem uso no período.</p>}
          </ul>
        </Panel>

        <Panel title="Modelos" subtitle="Chamadas, tokens e custo por modelo">
          <ul className="divide-y divide-gray-100 text-xs">
            {d.byModel.map((m) => (
              <li key={m.model} className="flex items-center gap-3 py-2">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 font-bold text-gray-700">{m.model}</span>
                <span className="ml-auto text-gray-500">{int.format(m.calls)} chamadas · {compact.format(m.tokens)} tokens</span>
                <span className="w-20 text-right font-bold text-blue-900">{money(m.cost)}</span>
              </li>
            ))}
            {d.byModel.length === 0 && <p className="py-6 text-center text-gray-400">Sem dados.</p>}
          </ul>
        </Panel>
      </div>

      <Panel title="Últimos erros" subtitle="Para investigar falhas do n8n ou da OpenAI">
        {d.recentErrors.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">Nenhum erro no período. 🎉</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-xs">
            {d.recentErrors.map((e, i) => (
              <li key={`${e.created_at}-${i}`} className="flex flex-wrap items-start gap-x-3 gap-y-0.5 py-2">
                <span className="w-28 shrink-0 text-gray-400">{format(parseISO(e.created_at), "dd/MM HH:mm")}</span>
                <span className="w-36 shrink-0 font-semibold" style={{ color: SOURCES[e.source].color }}>{SOURCES[e.source].label}</span>
                <span className="min-w-0 flex-1 text-gray-700">{e.error ?? "Erro sem mensagem"}</span>
                {e.user_id && <span className="text-gray-400">{nameOf(e.user_id)?.full_name ?? ""}</span>}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="text-[11px] text-gray-400">
        Custos calculados com a tabela de preços em src/lib/aiPricing.ts (Radar: Ajustes do Radar). Chamadas sem tokens medidos não entram no custo.
      </p>

      <RightDrawer open={settingsOpen && !!settings} onClose={() => setSettingsOpen(false)} label="Ajustes do Radar">
        {settings && profile && (
          <RadarSettingsDrawer settings={settings} userId={profile.id} canEdit onSaved={setSettings} onClose={() => setSettingsOpen(false)} />
        )}
      </RightDrawer>
    </div>
  );
}
