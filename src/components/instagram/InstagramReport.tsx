"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { BRAND, GRID_COLOR, TICK_STYLE, compact, fmt, percent, shortDate, signed } from "@/components/shared/dash-parts";
import {
  CATEGORY_COLOR, CATEGORY_LABEL, CATEGORY_ORDER, PERIOD_OPTIONS, type DateRange, type PeriodKey, categoryFromMedia, engagementRate, sumInsights, weekdayOf,
} from "@/lib/services/instagram";
import { buildHighlights } from "@/lib/instagram-highlights";
import { Delta, PageShell, ReportStyle, SectionTitle, avg, longDate, usePrintWhenReady } from "@/components/shared/report-parts";
import type { InstagramAudienceRow, InstagramDailyInsight, InstagramMedia, InstagramProfileInfo } from "@/types/database";

// Relatório A4 (3 páginas) dos insights de um perfil. Mesmo modelo para todos
// os perfis; o PDF sai pelo "Salvar como PDF" do diálogo de impressão do
// navegador (estilos @media print abaixo garantem cores, tamanho e quebras).

type Entry = { key: string; value: number };

const GENDER_LABEL: Record<string, string> = { F: "Feminino", M: "Masculino", U: "Não informado" };
const AGE_ORDER = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const CHART_W = 690;

const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["pt-BR"], { type: "region" }) : null;
const countryName = (code: string) => {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
};

function audienceEntries(rows: InstagramAudienceRow[], kind: InstagramAudienceRow["kind"]): Entry[] {
  const row = rows.find((r) => r.kind === kind);
  return Array.isArray(row?.data) ? (row.data as Entry[]) : [];
}

export function InstagramReport({
  accountId, accounts, period, range, prevRange, periodText, lengthDays, generatedAt, profile, rows, prevRows, hasPrevious, media, prevMedia,
  audience, followersNow, lastSync, autoPrint,
}: {
  accountId: string;
  accounts: { id: string; label: string }[];
  period: PeriodKey;
  range: DateRange;
  prevRange: DateRange;
  periodText: string;
  lengthDays: number;
  generatedAt: string;
  profile: InstagramProfileInfo;
  rows: InstagramDailyInsight[];
  prevRows: InstagramDailyInsight[];
  hasPrevious: boolean;
  media: InstagramMedia[];
  prevMedia: InstagramMedia[];
  audience: InstagramAudienceRow[];
  followersNow: number | null;
  lastSync: string;
  autoPrint: boolean;
}) {
  const router = useRouter();
  const paperRef = useRef<HTMLDivElement>(null);
  const go = (next: { account?: string; period?: PeriodKey; from?: string; to?: string }) => {
    const q = new URLSearchParams({
      account: next.account ?? accountId,
      period: next.period ?? period,
      from: next.from ?? range.from,
      to: next.to ?? range.to,
    });
    router.replace(`/relatorio/instagram?${q}`);
  };
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  usePrintWhenReady(paperRef, autoPrint, mounted);

  const t = useMemo(() => sumInsights(rows), [rows]);
  const p = useMemo(() => sumInsights(prevRows), [prevRows]);
  const prev = (v: number) => (hasPrevious ? v : null);
  const er = engagementRate(t.interactions, t.reach);
  const publications = media.filter((m) => categoryFromMedia(m) !== "story");
  const stories = media.length - publications.length;
  const prevPubs = prevMedia.filter((m) => categoryFromMedia(m) !== "story").length;
  const prevStories = prevMedia.length - prevPubs;
  const mediaPrev = hasPrevious && prevMedia.length > 0;
  const hasNet = rows.slice(-30).some((r) => r.net_followers !== 0);
  const highlights = useMemo(() => buildHighlights(rows, media).slice(0, 6), [rows, media]);

  const viewsSeries = rows.map((r) => ({ label: shortDate(r.date), value: r.views }));
  const averageViews = avg(rows.map((r) => r.views));

  const postsByDay = useMemo(() => {
    const dates = new Set(rows.map((r) => r.date));
    media.forEach((m) => dates.add(m.post_date));
    return Array.from(dates).sort().map((date) => {
      const e: Record<string, number | string> = { label: shortDate(date) };
      CATEGORY_ORDER.forEach((c) => (e[c] = 0));
      media.filter((m) => m.post_date === date).forEach((m) => {
        const c = categoryFromMedia(m);
        e[c] = (e[c] as number) + 1;
      });
      return e;
    });
  }, [rows, media]);
  const presentCats = CATEGORY_ORDER.filter((c) => media.some((m) => categoryFromMedia(m) === c));

  const formats = CATEGORY_ORDER.map((c) => {
    const items = media.filter((m) => categoryFromMedia(m) === c);
    const reach = items.reduce((s, m) => s + m.reach, 0);
    const inter = items.reduce((s, m) => s + m.total_interactions, 0);
    return {
      c,
      count: items.length,
      views: t.viewsByCategory[c] ?? 0,
      avgViews: avg(items.map((m) => m.views)),
      er: engagementRate(inter, reach),
    };
  }).filter((f) => f.count > 0 || f.views > 0);

  const weekday = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((label, wd) => ({
    label,
    value: Math.round(avg(rows.filter((r) => weekdayOf(r.date) === wd).map((r) => r.views))),
  }));
  const bestWeekday = weekday.reduce((m, w) => (w.value > m.value ? w : m), weekday[0]);

  const topPosts = [...publications].sort((a, b) => b.views - a.views).slice(0, 5);

  const gender = audienceEntries(audience, "gender");
  const ageRaw = audienceEntries(audience, "age");
  const age = AGE_ORDER.map((k) => ({ label: k, value: ageRaw.find((e) => e.key === k)?.value ?? 0 }));
  const cities = audienceEntries(audience, "city").slice(0, 5);
  const countries = audienceEntries(audience, "country").slice(0, 3);
  const audTotal = gender.reduce((s, e) => s + e.value, 0) || age.reduce((s, e) => s + e.value, 0);
  const hasAudience = audTotal > 0;

  const username = profile.username ?? "instagram";
  const indicators: { label: string; cur: number; prev: number | null; text: string; prevText: string }[] = [
    { label: "Visualizações", cur: t.views, prev: prev(p.views), text: fmt(t.views), prevText: hasPrevious ? fmt(p.views) : "—" },
    { label: "Contas alcançadas", cur: t.reach, prev: prev(p.reach), text: fmt(t.reach), prevText: hasPrevious ? fmt(p.reach) : "—" },
    { label: "Interações", cur: t.interactions, prev: prev(p.interactions), text: fmt(t.interactions), prevText: hasPrevious ? fmt(p.interactions) : "—" },
    {
      label: "Taxa de engajamento", cur: er, prev: hasPrevious ? engagementRate(p.interactions, p.reach) : null,
      text: `${er.toFixed(1).replace(".", ",")}%`,
      prevText: hasPrevious ? `${engagementRate(p.interactions, p.reach).toFixed(1).replace(".", ",")}%` : "—",
    },
    { label: "Visitas ao perfil", cur: t.profileViews, prev: prev(p.profileViews), text: fmt(t.profileViews), prevText: hasPrevious ? fmt(p.profileViews) : "—" },
    { label: "Cliques no link da bio", cur: t.websiteClicks, prev: prev(p.websiteClicks), text: fmt(t.websiteClicks), prevText: hasPrevious ? fmt(p.websiteClicks) : "—" },
    { label: "Publicações (feed e reels)", cur: publications.length, prev: mediaPrev ? prevPubs : null, text: fmt(publications.length), prevText: mediaPrev ? fmt(prevPubs) : "—" },
    { label: "Stories publicados", cur: stories, prev: mediaPrev ? prevStories : null, text: fmt(stories), prevText: mediaPrev ? fmt(prevStories) : "—" },
  ];

  const total = 3;

  return (
    <div className="report-root">
      <ReportStyle />

      <div className="no-print sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <Button size="sm" variant="secondary" onClick={() => router.push("/instagram")}>
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Instagram
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-56">
            <Select value={accountId} onChange={(e) => go({ account: e.target.value })}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Select value={period} onChange={(e) => go({ period: e.target.value as PeriodKey })}>
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </Select>
          </div>
          {period === "custom" && (
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
              <input
                type="date"
                value={range.from}
                max={range.to}
                onChange={(e) => e.target.value && go({ from: e.target.value })}
                className="h-10 rounded-[14px] border border-gray-200 px-3 text-sm text-blue-900"
              />
              até
              <input
                type="date"
                value={range.to}
                min={range.from}
                onChange={(e) => e.target.value && go({ to: e.target.value })}
                className="h-10 rounded-[14px] border border-gray-200 px-3 text-sm text-blue-900"
              />
            </div>
          )}
          <Button size="sm" onClick={() => window.print()}>
            <Download className="h-4 w-4" />
            Baixar PDF
          </Button>
        </div>
      </div>

      <div ref={paperRef}>
        {/* ── Página 1: resumo ── */}
        <PageShell n={1} total={total} footer={`Help Multas · Relatório de Insights do Instagram · @${username}`}>
          <header className="-mx-[12mm] -mt-[12mm] mb-5 flex items-center gap-4 bg-blue-900 px-[12mm] py-6 text-white">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-2 ring-yellow-500">
              {profile.profile_picture_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.profile_picture_url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-bold">IG</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-500">Relatório de insights · Instagram</p>
              <h1 className="truncate font-display text-2xl font-bold leading-tight">{profile.name || username}</h1>
              <p className="text-sm text-blue-100">@{username}</p>
            </div>
            <div className="text-right text-xs text-blue-100">
              <p className="text-[10px] uppercase tracking-wide text-blue-200">Período</p>
              <p className="text-sm font-bold text-white">{range.from === range.to ? longDate(range.from) : `${longDate(range.from)} a ${longDate(range.to)}`}</p>
              <p>{lengthDays > 1 && period === "custom" ? `${lengthDays} dias` : periodText}</p>
            </div>
          </header>

          <div className="mb-5 grid grid-cols-4 gap-3">
            {[
              { label: "Seguidores", value: followersNow != null ? fmt(followersNow) : "—", delta: null as number | null, cur: 0, sub: hasNet ? `${signed(t.netFollowers)} no período` : "" },
              { label: "Visualizações", value: fmt(t.views), cur: t.views, delta: prev(p.views), sub: "" },
              { label: "Alcance", value: fmt(t.reach), cur: t.reach, delta: prev(p.reach), sub: "" },
              { label: "Interações", value: fmt(t.interactions), cur: t.interactions, delta: prev(p.interactions), sub: `${er.toFixed(1).replace(".", ",")}% de engajamento` },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-gray-200 bg-gray-050 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{k.label}</p>
                <p className="mt-1 font-display text-2xl font-bold text-blue-900">{k.value}</p>
                <p className="mt-0.5 min-h-[14px] text-[10px] text-gray-500">
                  {k.delta != null ? <><Delta cur={k.cur} prev={k.delta} /> <span>vs. período anterior</span></> : k.sub}
                </p>
              </div>
            ))}
          </div>

          <SectionTitle hint={hasPrevious ? `Comparado a ${longDate(prevRange.from)}${prevRange.from === prevRange.to ? "" : ` – ${longDate(prevRange.to)}`}` : range.to >= generatedAt.slice(0, 10) ? "Hoje é parcial — sem comparação" : "Sem período anterior sincronizado"}>
            Indicadores do período
          </SectionTitle>
          <table className="mb-5 w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-gray-500">
                <th className="py-1">Indicador</th>
                <th className="py-1 text-right">Período</th>
                <th className="py-1 text-right">Anterior</th>
                <th className="py-1 text-right">Variação</th>
              </tr>
            </thead>
            <tbody>
              {indicators.map((i) => (
                <tr key={i.label} className="border-t border-gray-100">
                  <td className="py-1.5 font-semibold text-blue-900">{i.label}</td>
                  <td className="py-1.5 text-right font-bold text-blue-900">{i.text}</td>
                  <td className="py-1.5 text-right text-gray-500">{i.prevText}</td>
                  <td className="py-1.5 text-right"><Delta cur={i.cur} prev={i.prev} /></td>
                </tr>
              ))}
              {hasNet && (
                <tr className="border-t border-gray-100">
                  <td className="py-1.5 font-semibold text-blue-900">Seguidores líquidos</td>
                  <td className="py-1.5 text-right font-bold text-blue-900">{signed(t.netFollowers)}</td>
                  <td className="py-1.5 text-right text-gray-500">—</td>
                  <td className="py-1.5 text-right text-gray-400">—</td>
                </tr>
              )}
            </tbody>
          </table>

          <SectionTitle>Quem assiste ao conteúdo</SectionTitle>
          <div className="mb-5">
            <div className="flex h-5 overflow-hidden rounded-full bg-gray-100">
              <div style={{ width: `${t.views ? (t.viewsFollowers / t.views) * 100 : 0}%`, background: BRAND.blue }} />
              <div style={{ width: `${t.views ? (t.viewsNonFollowers / t.views) * 100 : 0}%`, background: BRAND.yellow }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px]">
              <span className="font-semibold text-blue-900">● Seguidores · {fmt(t.viewsFollowers)} ({percent(t.viewsFollowers, t.views, 0)})</span>
              <span className="font-semibold text-blue-900">
                <span style={{ color: BRAND.yellow }}>●</span> Não seguidores · {fmt(t.viewsNonFollowers)} ({percent(t.viewsNonFollowers, t.views, 0)})
              </span>
            </div>
          </div>

          <SectionTitle>Destaques do período</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {highlights.map((h) => (
              <div key={h.title} className="rounded-lg border-l-4 border-yellow-500 bg-gray-050 px-3 py-2">
                <p className="text-[11px] font-bold text-blue-900">{h.title}</p>
                <p className="mt-0.5 text-[10px] leading-snug text-gray-600">{h.text}</p>
              </div>
            ))}
          </div>
        </PageShell>

        {/* ── Página 2: desempenho ── */}
        <PageShell n={2} total={total} footer={`Help Multas · Relatório de Insights do Instagram · @${username}`}>
          <SectionTitle hint={`Média de ${fmt(averageViews)} por dia`}>Visualizações por dia</SectionTitle>
          <div className="mb-5">
            {mounted && (
              <AreaChart width={CHART_W} height={200} data={viewsSeries} margin={{ left: -6, right: 8, top: 6 }}>
                <defs>
                  <linearGradient id="rpFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND.blue} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={BRAND.blue} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={18} />
                <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
                {averageViews > 0 && <ReferenceLine y={averageViews} stroke="#9aa7af" strokeDasharray="4 4" />}
                <Area type="monotone" dataKey="value" stroke={BRAND.blue} strokeWidth={2} fill="url(#rpFill)" isAnimationActive={false} />
              </AreaChart>
            )}
          </div>

          <div className="mb-5 grid grid-cols-2 gap-5">
            <div>
              <SectionTitle hint={`${media.length} no período`}>Publicações por dia</SectionTitle>
              {mounted && media.length > 0 ? (
                <>
                  <BarChart width={330} height={170} data={postsByDay} margin={{ left: -24, right: 4, top: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                    <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={14} />
                    <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
                    {presentCats.map((c) => (
                      <Bar key={c} dataKey={c} stackId="p" fill={CATEGORY_COLOR[c]} isAnimationActive={false} />
                    ))}
                  </BarChart>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-600">
                    {presentCats.map((c) => (
                      <span key={c}><span style={{ color: CATEGORY_COLOR[c] }}>●</span> {CATEGORY_LABEL[c]}</span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="py-10 text-center text-[11px] text-gray-400">Sem publicações sincronizadas.</p>
              )}
            </div>
            <div>
              <SectionTitle hint={hasNet ? `${signed(t.netFollowers)} no período` : ""}>Ganho de seguidores</SectionTitle>
              {mounted && hasNet ? (
                <BarChart width={330} height={170} data={rows.slice(-30).map((r) => ({ label: shortDate(r.date), v: r.net_followers }))} margin={{ left: -20, right: 4, top: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={14} />
                  <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
                  <ReferenceLine y={0} stroke="#9aa7af" />
                  <Bar dataKey="v" isAnimationActive={false}>
                    {rows.slice(-30).map((r) => (
                      <Cell key={r.date} fill={r.net_followers >= 0 ? BRAND.green : BRAND.red} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <p className="py-10 text-center text-[11px] text-gray-400">Sem dados de seguidores da Meta.</p>
              )}
            </div>
          </div>

          <SectionTitle hint="Views, alcance e interações por tipo de conteúdo">Desempenho por formato</SectionTitle>
          <table className="mb-5 w-full text-[11px]">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-gray-500">
                <th className="py-1">Formato</th>
                <th className="py-1 text-right">Publicações</th>
                <th className="py-1 text-right">Views</th>
                <th className="py-1 text-right">% das views</th>
                <th className="py-1 text-right">Média/publicação</th>
                <th className="py-1 text-right">Engajamento</th>
              </tr>
            </thead>
            <tbody>
              {formats.map((f) => (
                <tr key={f.c} className="border-t border-gray-100">
                  <td className="py-1.5 font-semibold text-blue-900">
                    <span style={{ color: CATEGORY_COLOR[f.c] }}>●</span> {CATEGORY_LABEL[f.c]}
                  </td>
                  <td className="py-1.5 text-right">{fmt(f.count)}</td>
                  <td className="py-1.5 text-right font-bold text-blue-900">{fmt(f.views)}</td>
                  <td className="py-1.5 text-right">{percent(f.views, t.views, 0)}</td>
                  <td className="py-1.5 text-right">{f.count ? fmt(f.avgViews) : "—"}</td>
                  <td className="py-1.5 text-right">{f.count ? `${f.er.toFixed(1).replace(".", ",")}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <SectionTitle hint={bestWeekday?.value ? `Melhor: ${bestWeekday.label}` : ""}>Views por dia da semana</SectionTitle>
              {mounted && (
                <BarChart width={330} height={150} data={weekday} margin={{ left: -14, right: 4, top: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                  <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
                  <Bar dataKey="value" isAnimationActive={false} radius={[4, 4, 0, 0]}>
                    {weekday.map((w) => (
                      <Cell key={w.label} fill={w.label === bestWeekday?.label ? BRAND.yellow : BRAND.blue} />
                    ))}
                  </Bar>
                </BarChart>
              )}
              <p className="text-center text-[9px] text-gray-400">Média de visualizações por dia da semana</p>
            </div>
            <div>
              <SectionTitle hint={`${fmt(t.interactions)} no total`}>Interações</SectionTitle>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Curtidas", t.likes], ["Comentários", t.comments], ["Compart.", t.shares],
                  ["Salvos", t.saves], ["Respostas", t.replies], ["Reposts", t.reposts],
                ].map(([label, v]) => (
                  <div key={label as string} className="rounded-lg bg-gray-050 p-2.5 text-center">
                    <p className="font-display text-base font-bold text-blue-900">{fmt(v as number)}</p>
                    <p className="text-[9px] font-semibold uppercase text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PageShell>

        {/* ── Página 3: conteúdo e público ── */}
        <PageShell n={3} total={total} footer={`Help Multas · Relatório de Insights do Instagram · @${username}`}>
          <SectionTitle hint="Por visualizações no período">Top 5 publicações</SectionTitle>
          {topPosts.length === 0 ? (
            <p className="mb-5 py-6 text-center text-[11px] text-gray-400">Sem publicações sincronizadas neste período.</p>
          ) : (
            <table className="mb-5 w-full text-[11px]">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-gray-500">
                  <th className="py-1" colSpan={2}>Publicação</th>
                  <th className="py-1 text-right">Views</th>
                  <th className="py-1 text-right">Alcance</th>
                  <th className="py-1 text-right">Interações</th>
                  <th className="py-1 text-right">Eng.</th>
                </tr>
              </thead>
              <tbody>
                {topPosts.map((m, i) => (
                  <tr key={m.media_id} className="border-t border-gray-100 align-middle">
                    <td className="w-[52px] py-1.5">
                      <div className="relative h-11 w-11 overflow-hidden rounded-md bg-gray-100">
                        {m.thumbnail_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.thumbnail_url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                        )}
                        <span className="absolute left-0 top-0 rounded-br-md bg-yellow-500 px-1 text-[9px] font-bold text-blue-900">{i + 1}</span>
                      </div>
                    </td>
                    <td className="py-1.5 pr-2">
                      <p className="line-clamp-2 max-w-[260px] leading-snug text-blue-900">{m.caption?.replace(/\s+/g, " ") || "Sem legenda"}</p>
                      <p className="text-[9px] text-gray-400">
                        {CATEGORY_LABEL[categoryFromMedia(m)]} · {longDate(m.post_date)}
                      </p>
                    </td>
                    <td className="py-1.5 text-right font-bold text-blue-900">{fmt(m.views)}</td>
                    <td className="py-1.5 text-right">{fmt(m.reach)}</td>
                    <td className="py-1.5 text-right">{fmt(m.total_interactions)}</td>
                    <td className="py-1.5 text-right">{engagementRate(m.total_interactions, m.reach).toFixed(1).replace(".", ",")}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <SectionTitle hint={hasAudience ? `Base de ${fmt(audTotal)} seguidores` : ""}>Público</SectionTitle>
          {!hasAudience ? (
            <p className="py-6 text-center text-[11px] text-gray-400">
              Dados de público indisponíveis (a Meta exige 100+ seguidores) ou ainda não sincronizados.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-5">
              <div>
                <p className="mb-1 text-[11px] font-bold text-blue-900">Gênero</p>
                <div className="mb-4 space-y-1.5">
                  {gender.map((g) => (
                    <div key={g.key}>
                      <div className="flex justify-between text-[11px]">
                        <span className="font-semibold text-blue-900">{GENDER_LABEL[g.key] ?? g.key}</span>
                        <span>{percent(g.value, audTotal, 1)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div className="h-2 rounded-full" style={{ width: `${(g.value / audTotal) * 100}%`, background: g.key === "F" ? "#e0556b" : g.key === "M" ? BRAND.blue : "#9aa7af" }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mb-1 text-[11px] font-bold text-blue-900">Faixa etária</p>
                {mounted && (
                  <BarChart width={330} height={140} data={age} margin={{ left: -8, right: 4, top: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                    <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                    <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
                    <Bar dataKey="value" fill={BRAND.blue} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                )}
              </div>
              <div>
                <p className="mb-1 text-[11px] font-bold text-blue-900">Principais cidades</p>
                <div className="mb-4 space-y-1.5">
                  {cities.map((c) => (
                    <div key={c.key}>
                      <div className="flex justify-between text-[11px]">
                        <span className="truncate font-semibold text-blue-900">{c.key}</span>
                        <span>{percent(c.value, audTotal, 1)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div className="h-2 rounded-full" style={{ width: `${(c.value / (cities[0]?.value || 1)) * 100}%`, background: BRAND.yellow }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mb-1 text-[11px] font-bold text-blue-900">Principais países</p>
                <div className="space-y-1">
                  {countries.map((c) => (
                    <div key={c.key} className="flex justify-between text-[11px]">
                      <span className="font-semibold text-blue-900">{countryName(c.key)}</span>
                      <span>{percent(c.value, audTotal, 1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="absolute bottom-[18mm] left-[12mm] right-[12mm] rounded-lg bg-gray-050 p-3 text-[9px] leading-snug text-gray-500">
            <p className="mb-0.5 font-bold uppercase tracking-wide text-gray-600">Notas metodológicas</p>
            Fonte: API oficial do Instagram (Meta), somente leitura. Dias fechados no fuso de São Paulo; o dia corrente não entra.
            Alcance e taxa de engajamento usam a soma das contas únicas por dia, portanto o mesmo usuário pode ser contado em dias diferentes.
            Stories só ficam disponíveis na API por 24h e são contados a partir da primeira sincronização. O ganho líquido de seguidores cobre no máximo 30 dias.
            Dados de público (idade, gênero, localização) são uma fotografia da última sincronização.
            Relatório gerado em {new Date(generatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            {lastSync ? ` · última sincronização em ${new Date(lastSync).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : ""}.
          </div>
        </PageShell>
      </div>
    </div>
  );
}
