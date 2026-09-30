"use client";

import { useMemo, useState } from "react";
import {
  Activity, CalendarDays, Clock, Eye, Flame, Heart, Lightbulb, Link2, MousePointerClick, Send, Target, Trophy,
  UserPlus, Users, Film, Megaphone, ScanEye,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, XAxis, YAxis,
} from "recharts";
import {
  BRAND, BarList, Chip, ChartTooltip, Donut, GRID_COLOR, Insight, Kpi, Panel, RTooltip, TICK_STYLE, compact, fmt,
  shortDate, signed, tipDate,
} from "@/components/shared/dash-parts";
import {
  CATEGORY_COLOR, CATEGORY_LABEL, CATEGORY_ORDER, WEEKDAY_LONG, WEEKDAY_SHORT, categoryFromMedia, engagementRate,
  sumInsights, weekdayOf, type ContentCategory,
} from "@/lib/services/instagram";
import { buildHighlights, type HighlightKey } from "@/lib/instagram-highlights";
import type { InstagramDailyInsight, InstagramMedia } from "@/types/database";

interface Metric {
  key: string;
  label: string;
  color: string;
  get: (r: InstagramDailyInsight) => number;
  split?: { a: string; b: string; getA: (r: InstagramDailyInsight) => number; getB: (r: InstagramDailyInsight) => number };
}

const METRICS: Metric[] = [
  {
    key: "views", label: "Visualizações", color: BRAND.blue, get: (r) => r.views,
    split: { a: "Seguidores", b: "Não seguidores", getA: (r) => r.views_followers, getB: (r) => r.views_non_followers },
  },
  {
    key: "reach", label: "Alcance", color: BRAND.steel, get: (r) => r.reach,
    split: { a: "Seguidores", b: "Não seguidores", getA: (r) => r.reach_followers ?? 0, getB: (r) => r.reach_non_followers ?? 0 },
  },
  { key: "interactions", label: "Interações", color: BRAND.green, get: (r) => r.total_interactions },
  { key: "profile_views", label: "Visitas ao perfil", color: "#8b5fbf", get: (r) => r.profile_views },
  { key: "website_clicks", label: "Cliques no link", color: "#e07b39", get: (r) => r.website_clicks },
  { key: "net_followers", label: "Seguidores líquidos", color: BRAND.yellow, get: (r) => r.net_followers },
];

const HIGHLIGHT_ICONS: Record<HighlightKey, typeof Lightbulb> = {
  weekday: CalendarDays,
  reach: Users,
  format: Film,
  engagement: Activity,
  topPost: Trophy,
  record: Flame,
  consistency: Clock,
  followers: UserPlus,
};

function avg(values: number[]) {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

export function OverviewTab({
  periodLabel, rows, prevRows, hasPrevious, media, prevMedia, followersNow, dailyDelta, clicksToday, clicksTotal,
}: {
  periodLabel: string;
  rows: InstagramDailyInsight[];
  prevRows: InstagramDailyInsight[];
  hasPrevious: boolean;
  media: InstagramMedia[];
  prevMedia: InstagramMedia[];
  followersNow: number | null;
  dailyDelta: number | null;
  clicksToday: number;
  clicksTotal: number;
}) {
  const [metricKey, setMetricKey] = useState("views");
  const [split, setSplit] = useState(false);
  const [hiddenCats, setHiddenCats] = useState<Set<ContentCategory>>(new Set());

  const t = useMemo(() => sumInsights(rows), [rows]);
  const p = useMemo(() => sumInsights(prevRows), [prevRows]);
  const prev = <K extends keyof typeof t>(k: K) => (hasPrevious ? (p[k] as number) : null);
  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];

  const publications = media.filter((m) => categoryFromMedia(m) !== "story").length;
  const stories = media.length - publications;
  const prevPublications = prevMedia.filter((m) => categoryFromMedia(m) !== "story").length;
  const prevStories = prevMedia.length - prevPublications;
  const mediaHasPrev = hasPrevious && prevMedia.length > 0;
  const er = engagementRate(t.interactions, t.reach);
  const prevEr = engagementRate(p.interactions, p.reach);

  // ── Série do gráfico principal ──
  const series = useMemo(
    () =>
      rows.map((r) => ({
        date: r.date,
        label: shortDate(r.date),
        tip: tipDate(r.date),
        value: metric.get(r),
        a: metric.split?.getA(r) ?? 0,
        b: metric.split?.getB(r) ?? 0,
      })),
    [rows, metric]
  );
  const values = series.map((s) => s.value);
  const average = avg(values);
  const best = series.reduce((m, s) => (s.value > m.value ? s : m), series[0]);
  const showSplit = split && !!metric.split;

  // ── Publicações por dia ──
  const postsByDay = useMemo(() => {
    const dates = new Set(rows.map((r) => r.date));
    media.forEach((m) => dates.add(m.post_date));
    const sorted = Array.from(dates).sort();
    return sorted.map((date) => {
      const entry: Record<string, number | string> = { date, label: shortDate(date), tip: tipDate(date) };
      CATEGORY_ORDER.forEach((c) => (entry[c] = 0));
      media.filter((m) => m.post_date === date).forEach((m) => {
        const c = categoryFromMedia(m);
        entry[c] = (entry[c] as number) + 1;
      });
      return entry;
    });
  }, [rows, media]);
  const presentCats = CATEGORY_ORDER.filter((c) => media.some((m) => categoryFromMedia(m) === c));

  // ── Seguidores ──
  const netRows = rows.slice(-Math.min(rows.length, 30));
  const hasNet = netRows.some((r) => r.net_followers !== 0);
  const followerEvolution = useMemo(() => {
    if (followersNow == null || !hasNet) return [];
    let current = followersNow;
    const out: { label: string; tip: string; followers: number }[] = [];
    for (let i = netRows.length - 1; i >= 0; i--) {
      out.unshift({ label: shortDate(netRows[i].date), tip: tipDate(netRows[i].date), followers: current });
      current -= netRows[i].net_followers;
    }
    return out;
  }, [netRows, followersNow, hasNet]);

  // ── Dia da semana ──
  const weekday = useMemo(() => {
    return WEEKDAY_SHORT.map((label, wd) => {
      const dayRows = rows.filter((r) => weekdayOf(r.date) === wd);
      const posts = postsByDay.filter((d) => weekdayOf(d.date as string) === wd);
      const postCount = posts.reduce(
        (s, d) => s + CATEGORY_ORDER.reduce((a, c) => a + (c === "story" ? 0 : (d[c] as number)), 0),
        0
      );
      return {
        label,
        tip: WEEKDAY_LONG[wd],
        views: Math.round(avg(dayRows.map((r) => r.views))),
        posts: posts.length ? Number((postCount / posts.length).toFixed(1)) : 0,
        samples: dayRows.length,
      };
    });
  }, [rows, postsByDay]);

  // ── Insights automáticos ──
  const insights = useMemo(() => buildHighlights(rows, media), [rows, media]);

  const interactionBars = [
    { label: "Curtidas", value: t.likes, color: "#e0556b" },
    { label: "Comentários", value: t.comments, color: BRAND.steel },
    { label: "Compartilhamentos", value: t.shares, color: BRAND.green },
    { label: "Salvamentos", value: t.saves, color: BRAND.yellow },
    { label: "Respostas a stories", value: t.replies, color: "#8b5fbf" },
    { label: "Reposts", value: t.reposts, color: BRAND.blue },
  ].filter((i) => i.value > 0);

  const catSlices = (map: Partial<Record<ContentCategory, number>>) =>
    CATEGORY_ORDER.map((c) => ({ name: CATEGORY_LABEL[c], value: map[c] ?? 0, color: CATEGORY_COLOR[c] }));

  const spark = (get: (r: InstagramDailyInsight) => number) => rows.map(get);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Seguidores"
          icon={Users}
          value={followersNow != null ? fmt(followersNow) : "—"}
          hint={dailyDelta != null ? `${signed(dailyDelta)} vs. dia anterior` : "Coleta a cada 15 min"}
          color={BRAND.blue}
        />
        <Kpi
          label="Visualizações" icon={Eye} value={fmt(t.views)} current={t.views} previous={prev("views")}
          spark={spark((r) => r.views)} color={BRAND.blue} active={metricKey === "views"} onClick={() => setMetricKey("views")}
        />
        <Kpi
          label="Alcance" icon={ScanEye} value={fmt(t.reach)} current={t.reach} previous={prev("reach")}
          spark={spark((r) => r.reach)} color={BRAND.steel} active={metricKey === "reach"} onClick={() => setMetricKey("reach")}
        />
        <Kpi
          label="Interações" icon={Heart} value={fmt(t.interactions)} current={t.interactions} previous={prev("interactions")}
          spark={spark((r) => r.total_interactions)} color={BRAND.green} active={metricKey === "interactions"}
          onClick={() => setMetricKey("interactions")}
        />
        <Kpi
          label="Taxa de engajamento" icon={Target} value={`${er.toFixed(1).replace(".", ",")}%`} current={er}
          previous={hasPrevious ? prevEr : null} hint="Interações ÷ alcance"
        />
        <Kpi
          label="Seguidores líquidos" icon={UserPlus} value={hasNet ? signed(t.netFollowers) : "—"}
          current={t.netFollowers} previous={null} spark={spark((r) => r.net_followers)} color={BRAND.yellow}
          active={metricKey === "net_followers"} onClick={() => setMetricKey("net_followers")}
          hint={hasNet ? "Últimos 30 dias no máximo" : "Aguardando dados da Meta"}
        />
        <Kpi
          label="Visitas ao perfil" icon={MousePointerClick} value={fmt(t.profileViews)} current={t.profileViews}
          previous={prev("profileViews")} spark={spark((r) => r.profile_views)} color="#8b5fbf"
          active={metricKey === "profile_views"} onClick={() => setMetricKey("profile_views")}
        />
        <Kpi
          label="Cliques no link" icon={Link2} value={fmt(t.websiteClicks)} current={t.websiteClicks}
          previous={prev("websiteClicks")} spark={spark((r) => r.website_clicks)} color="#e07b39"
          active={metricKey === "website_clicks"} onClick={() => setMetricKey("website_clicks")}
        />
        <Kpi
          label="Publicações" icon={Send} value={fmt(publications)} current={publications}
          previous={mediaHasPrev ? prevPublications : null} hint="Reels, posts e carrosséis"
        />
        <Kpi
          label="Stories publicados" icon={Megaphone} value={fmt(stories)} current={stories}
          previous={mediaHasPrev ? prevStories : null} hint="Contados desde a 1ª sincronização"
        />
        <Kpi label="Cliques LP (hoje)" icon={MousePointerClick} value={fmt(clicksToday)} hint="Link da bio rastreado pela LP" />
        <Kpi label="Cliques LP (30 dias)" icon={Link2} value={fmt(clicksTotal)} hint="Link da bio rastreado pela LP" />
      </div>

      {/* Gráfico principal */}
      <Panel
        title="Desempenho por dia"
        subtitle={
          <>
            Média de <b>{compact(average)}</b> por dia
            {best && best.value > 0 && (
              <>
                {" "}· melhor dia <b>{best.tip}</b> ({fmt(best.value)})
              </>
            )}
          </>
        }
        action={
          metric.split && (
            <Chip active={split} onClick={() => setSplit((v) => !v)}>
              Seguidores × não seguidores
            </Chip>
          )
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <Chip key={m.key} active={metricKey === m.key} color={m.color} onClick={() => setMetricKey(m.key)}>
              {m.label}
            </Chip>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={series} margin={{ left: -10, right: 8 }}>
            <defs>
              <linearGradient id="mainFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metric.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={metric.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
            <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
            <RTooltip content={<ChartTooltip total={showSplit} />} />
            {!showSplit && average > 0 && metric.key !== "net_followers" && (
              <ReferenceLine y={average} stroke="#9aa7af" strokeDasharray="4 4" />
            )}
            {showSplit ? (
              <>
                <Area isAnimationActive={false} type="monotone" dataKey="a" name={metric.split!.a} stackId="s" stroke={BRAND.blue} fill={BRAND.blue} fillOpacity={0.85} />
                <Area isAnimationActive={false} type="monotone" dataKey="b" name={metric.split!.b} stackId="s" stroke={BRAND.yellow} fill={BRAND.yellow} fillOpacity={0.85} />
              </>
            ) : (
              <Area isAnimationActive={false}
                type="monotone" dataKey="value" name={metric.label} stroke={metric.color} strokeWidth={2.5} fill="url(#mainFill)"
                dot={{ r: 2.5, fill: metric.color }} activeDot={{ r: 5 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      {/* Publicações por dia + seguidores */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Publicações por dia"
          subtitle={
            <>
              <b>{media.length}</b> no período · média de <b>{(media.length / Math.max(postsByDay.length, 1)).toFixed(1).replace(".", ",")}</b> por dia
            </>
          }
        >
          {media.length === 0 ? (
            <p className="flex h-[260px] items-center justify-center text-center text-sm text-gray-400">
              Sem publicações sincronizadas neste período. Clique em “Atualizar agora”.
            </p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap gap-2">
                {presentCats.map((c) => (
                  <Chip
                    key={c}
                    active={!hiddenCats.has(c)}
                    color={CATEGORY_COLOR[c]}
                    onClick={() =>
                      setHiddenCats((prevSet) => {
                        const next = new Set(prevSet);
                        if (next.has(c)) next.delete(c);
                        else next.add(c);
                        return next;
                      })
                    }
                  >
                    {CATEGORY_LABEL[c]}
                  </Chip>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={postsByDay} margin={{ left: -24, right: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
                  <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RTooltip content={<ChartTooltip total />} cursor={{ fill: "#f4f6f8" }} />
                  {presentCats.filter((c) => !hiddenCats.has(c)).map((c) => (
                    <Bar isAnimationActive={false} key={c} dataKey={c} name={CATEGORY_LABEL[c]} stackId="posts" fill={CATEGORY_COLOR[c]} radius={[2, 2, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-2 text-[11px] text-gray-400">
                Stories só aparecem na API por 24h: entram na contagem a partir da primeira sincronização.
              </p>
            </>
          )}
        </Panel>

        <Panel
          title="Seguidores"
          subtitle={hasNet ? "Evolução e ganho líquido por dia" : "Aguardando dados de seguidores da Meta"}
        >
          {!hasNet ? (
            <p className="flex h-[260px] items-center justify-center text-center text-sm text-gray-400">
              A Meta ainda não retornou o ganho diário de seguidores.
            </p>
          ) : (
            <div className="space-y-2">
              {followerEvolution.length > 1 && (
                <ResponsiveContainer width="100%" height={130}>
                  <ComposedChart data={followerEvolution} margin={{ left: -4, right: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                    <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
                    <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} domain={["dataMin - 20", "dataMax + 20"]} tickFormatter={compact} />
                    <RTooltip content={<ChartTooltip />} />
                    <Line isAnimationActive={false} type="monotone" dataKey="followers" name="Seguidores" stroke={BRAND.blue} strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={netRows.map((r) => ({ label: shortDate(r.date), tip: tipDate(r.date), v: r.net_followers }))} margin={{ left: -4, right: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
                  <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
                  <RTooltip content={<ChartTooltip format={signed} />} cursor={{ fill: "#f4f6f8" }} />
                  <ReferenceLine y={0} stroke="#9aa7af" />
                  <Bar isAnimationActive={false} dataKey="v" name="Ganho líquido" radius={[3, 3, 0, 0]}>
                    {netRows.map((r) => (
                      <Cell key={r.date} fill={r.net_followers >= 0 ? BRAND.green : BRAND.red} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      {/* Distribuições */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Visualizações por tipo" subtitle="De onde vem a audiência">
          <Donut data={catSlices(t.viewsByCategory)} centerLabel="visualizações" centerValue={compact(t.views)} />
        </Panel>
        <Panel title="Seguidores × não seguidores" subtitle="Quem assiste ao seu conteúdo">
          <Donut
            data={[
              { name: "Seguidores", value: t.viewsFollowers, color: BRAND.blue },
              { name: "Não seguidores", value: t.viewsNonFollowers, color: BRAND.yellow },
            ]}
            centerLabel="visualizações"
            centerValue={compact(t.views)}
          />
        </Panel>
        <Panel title="Alcance por tipo" subtitle="Contas únicas alcançadas">
          <Donut data={catSlices(t.reachByCategory)} centerLabel="alcance" centerValue={compact(t.reach)} />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Interações" subtitle={`${fmt(t.interactions)} no período`}>
          <BarList items={interactionBars} total={t.interactions} />
        </Panel>
        <Panel title="Interações por tipo de conteúdo" subtitle="Onde o público mais reage">
          <Donut data={catSlices(t.interactionsByCategory)} centerLabel="interações" centerValue={compact(t.interactions)} />
        </Panel>
      </div>

      {/* Dia da semana */}
      <Panel title="Desempenho por dia da semana" subtitle="Média de visualizações (barras) e de publicações no feed/reels (linha)">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={weekday} margin={{ left: -10, right: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} />
            <YAxis yAxisId="l" tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
            <YAxis yAxisId="r" orientation="right" tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals />
            <RTooltip content={<ChartTooltip format={(n) => (Number.isInteger(n) ? fmt(n) : n.toFixed(1).replace(".", ","))} />} cursor={{ fill: "#f4f6f8" }} />
            <Bar isAnimationActive={false} yAxisId="l" dataKey="views" name="Views (média)" fill={BRAND.blue} radius={[6, 6, 0, 0]} />
            <Line isAnimationActive={false} yAxisId="r" type="monotone" dataKey="posts" name="Publicações (média)" stroke={BRAND.yellow} strokeWidth={2.5} dot={{ r: 3, fill: BRAND.yellow }} />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      {/* Destaques */}
      {insights.length > 0 && (
        <Panel title="Destaques do período" subtitle={`Leitura automática · ${periodLabel}`}>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {insights.map((i) => (
              <Insight key={i.title} icon={HIGHLIGHT_ICONS[i.key]} title={i.title}>
                {i.text}
              </Insight>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
