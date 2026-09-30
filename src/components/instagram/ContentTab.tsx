"use client";

import { useMemo, useState } from "react";
import { Bookmark, Eye, Heart, ImageOff, MessageCircle, ScanEye, Send, Timer } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import {
  Chip, ChartTooltip, GRID_COLOR, Kpi, Panel, RTooltip, TICK_STYLE, compact, fmt, shortDate,
} from "@/components/shared/dash-parts";
import {
  CATEGORY_COLOR, CATEGORY_LABEL, CATEGORY_ORDER, categoryFromMedia, engagementRate, type ContentCategory,
} from "@/lib/services/instagram";
import { cn } from "@/lib/utils";
import type { InstagramMedia } from "@/types/database";

type SortKey = "views" | "reach" | "interactions" | "likes" | "saves" | "shares" | "er" | "date";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "views", label: "Visualizações" },
  { key: "reach", label: "Alcance" },
  { key: "interactions", label: "Interações" },
  { key: "er", label: "Engajamento (%)" },
  { key: "likes", label: "Curtidas" },
  { key: "saves", label: "Salvamentos" },
  { key: "shares", label: "Compartilhamentos" },
  { key: "date", label: "Mais recentes" },
];

const PAGE = 12;

function sortValue(m: InstagramMedia, key: SortKey) {
  switch (key) {
    case "views": return m.views;
    case "reach": return m.reach;
    case "interactions": return m.total_interactions;
    case "likes": return m.like_count;
    case "saves": return m.saves;
    case "shares": return m.shares;
    case "er": return engagementRate(m.total_interactions, m.reach);
    case "date": return Date.parse(m.posted_at);
  }
}

function avg(values: number[]) {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

function formatPosted(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Thumb({ url, alt }: { url: string | null; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (!url || broken) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-300">
        <ImageOff className="h-8 w-8" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
  );
}

function MediaCard({ m, rank }: { m: InstagramMedia; rank?: number }) {
  const cat = categoryFromMedia(m);
  const er = engagementRate(m.total_interactions, m.reach);
  const stat = (Icon: typeof Eye, value: string, title: string) => (
    <span className="flex items-center gap-1 text-xs font-semibold text-gray-700" title={title}>
      <Icon className="h-3.5 w-3.5 text-gray-400" />
      {value}
    </span>
  );
  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-[var(--shadow-md)]">
      <a href={m.permalink ?? undefined} target="_blank" rel="noreferrer" className="block">
        <div className="relative aspect-square bg-gray-100">
          <Thumb url={m.thumbnail_url} alt={m.caption?.slice(0, 40) ?? "Publicação"} />
          <span
            className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
            style={{ background: CATEGORY_COLOR[cat] }}
          >
            {CATEGORY_LABEL[cat]}
          </span>
          {rank && rank <= 3 && (
            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 text-xs font-bold text-blue-900 shadow">
              {rank}
            </span>
          )}
        </div>
        <div className="space-y-2 p-3">
          <p className="text-[11px] text-gray-400">{formatPosted(m.posted_at)}</p>
          <p className="line-clamp-2 min-h-[2.25rem] text-xs leading-snug text-gray-700">{m.caption || "Sem legenda"}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {stat(Eye, compact(m.views), "Visualizações")}
            {stat(ScanEye, compact(m.reach), "Alcance")}
            {stat(Heart, compact(m.like_count), "Curtidas")}
            {cat !== "story" && stat(MessageCircle, compact(m.comments_count), "Comentários")}
            {stat(Send, compact(m.shares), "Compartilhamentos")}
            {cat !== "story" && stat(Bookmark, compact(m.saves), "Salvamentos")}
            {m.avg_watch_time_ms != null && stat(Timer, `${(m.avg_watch_time_ms / 1000).toFixed(1).replace(".", ",")}s`, "Tempo médio assistido")}
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-xs">
            <span className="text-gray-400">Engajamento</span>
            <span className="font-bold text-blue-900">{er.toFixed(1).replace(".", ",")}%</span>
          </div>
        </div>
      </a>
    </Card>
  );
}

export function ContentTab({ media }: { media: InstagramMedia[] }) {
  const [cat, setCat] = useState<"all" | ContentCategory>("all");
  const [sort, setSort] = useState<SortKey>("views");
  const [shown, setShown] = useState(PAGE);

  const presentCats = CATEGORY_ORDER.filter((c) => media.some((m) => categoryFromMedia(m) === c));
  const filtered = useMemo(
    () => media.filter((m) => cat === "all" || categoryFromMedia(m) === cat).sort((a, b) => sortValue(b, sort) - sortValue(a, sort)),
    [media, cat, sort]
  );

  const byCategory = useMemo(
    () =>
      presentCats.map((c) => {
        const items = media.filter((m) => categoryFromMedia(m) === c);
        const reach = items.reduce((s, m) => s + m.reach, 0);
        const inter = items.reduce((s, m) => s + m.total_interactions, 0);
        return {
          label: CATEGORY_LABEL[c],
          color: CATEGORY_COLOR[c],
          count: items.length,
          views: Math.round(avg(items.map((m) => m.views))),
          er: Number(engagementRate(inter, reach).toFixed(2)),
        };
      }),
    [media, presentCats]
  );

  if (media.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-gray-500">
        Nenhuma publicação sincronizada neste período. Clique em “Atualizar agora” para buscar posts, reels e stories.
      </Card>
    );
  }

  const reach = filtered.reduce((s, m) => s + m.reach, 0);
  const inter = filtered.reduce((s, m) => s + m.total_interactions, 0);
  const watch = filtered.filter((m) => m.avg_watch_time_ms != null).map((m) => m.avg_watch_time_ms as number);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Chip active={cat === "all"} onClick={() => { setCat("all"); setShown(PAGE); }}>
            Tudo ({media.length})
          </Chip>
          {presentCats.map((c) => (
            <Chip
              key={c}
              active={cat === c}
              color={CATEGORY_COLOR[c]}
              onClick={() => { setCat(c); setShown(PAGE); }}
            >
              {CATEGORY_LABEL[c]} ({media.filter((m) => categoryFromMedia(m) === c).length})
            </Chip>
          ))}
        </div>
        <div className="w-52">
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                Ordenar: {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Publicações" value={fmt(filtered.length)} />
        <Kpi label="Views (média)" value={fmt(avg(filtered.map((m) => m.views)))} hint="Por publicação" />
        <Kpi label="Alcance (média)" value={fmt(avg(filtered.map((m) => m.reach)))} hint="Por publicação" />
        <Kpi label="Engajamento" value={`${engagementRate(inter, reach).toFixed(1).replace(".", ",")}%`} hint="Interações ÷ alcance" />
        <Kpi
          label="Tempo médio (Reels)"
          value={watch.length ? `${(avg(watch) / 1000).toFixed(1).replace(".", ",")}s` : "—"}
          hint="Tempo assistido por view"
        />
      </div>

      {byCategory.length > 1 && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Média de visualizações por tipo" subtitle="Qual formato entrega mais">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byCategory} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
                <RTooltip content={<ChartTooltip />} cursor={{ fill: "#f4f6f8" }} />
                <Bar isAnimationActive={false} dataKey="views" name="Views por publicação" radius={[6, 6, 0, 0]}>
                  {byCategory.map((c) => <Cell key={c.label} fill={c.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
          <Panel title="Engajamento por tipo" subtitle="Interações ÷ alcance (%)">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byCategory} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} unit="%" />
                <RTooltip content={<ChartTooltip format={(n) => `${n.toFixed(2).replace(".", ",")}%`} />} cursor={{ fill: "#f4f6f8" }} />
                <Bar isAnimationActive={false} dataKey="er" name="Engajamento" radius={[6, 6, 0, 0]}>
                  {byCategory.map((c) => <Cell key={c.label} fill={c.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {filtered.slice(0, shown).map((m, i) => (
          <MediaCard key={m.media_id} m={m} rank={sort === "date" ? undefined : i + 1} />
        ))}
      </div>

      {shown < filtered.length && (
        <div className="flex justify-center">
          <button
            onClick={() => setShown((n) => n + PAGE)}
            className={cn(
              "rounded-full border border-blue-900 px-5 py-2 text-sm font-semibold text-blue-900 transition-colors hover:bg-blue-900 hover:text-white"
            )}
          >
            Ver mais ({filtered.length - shown})
          </button>
        </div>
      )}
      <p className="text-center text-[11px] text-gray-400">
        Período de {shortDate(media[media.length - 1].post_date)} a {shortDate(media[0].post_date)} · métricas atualizadas na última sincronização.
      </p>
    </div>
  );
}

