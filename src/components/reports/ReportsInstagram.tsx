"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Eye, FileDown, Heart, ImageOff, Link2, MousePointerClick, ScanEye, Send, Target, UserPlus, Users } from "lucide-react";
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import {
  BRAND, BarList, Chip, ChartTooltip, Donut, GRID_COLOR, Kpi, Panel, RTooltip, TICK_STYLE, compact, fmt, shortDate, signed, tipDate,
} from "@/components/shared/dash-parts";
import { Delta } from "@/components/shared/report-parts";
import { CATEGORY_COLOR, CATEGORY_LABEL, CATEGORY_ORDER, categoryFromMedia, engagementRate, type ContentCategory } from "@/lib/services/instagram";
import type { ReportModel } from "@/lib/reports-data";
import type { ReportPeriodKey } from "@/lib/report-period";
import { cn } from "@/lib/utils";

const ACCOUNT_COLORS = [BRAND.blue, BRAND.yellow, BRAND.steel, BRAND.green];
const pct1 = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;

function Thumb({ url }: { url: string | null }) {
  const [broken, setBroken] = useState(false);
  if (!url || broken) return <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-300"><ImageOff className="h-7 w-7" /></div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />;
}

export function ReportsInstagram({
  model, label, period, range,
}: {
  model: ReportModel;
  label: string;
  period: ReportPeriodKey;
  range: { from: string; to: string };
}) {
  const ig = model.instagram;
  const [acc, setAcc] = useState("all");
  const account = ig.accounts.find((a) => a.id === acc) ?? null;

  const totals = account ? account.totals : ig.totals;
  const prev = account ? account.prev : ig.prev;
  const hasPrev = account ? account.hasPrevious : ig.hasPrevious;
  const pubs = account ? account.pubs : ig.pubs;
  const stories = account ? account.stories : ig.stories;
  const followers = account ? account.followers : ig.accounts.reduce((s, a) => s + (a.followers ?? 0), 0) || null;
  const er = engagementRate(totals.interactions, totals.reach);
  const prevEr = engagementRate(prev.interactions, prev.reach);
  const pv = (v: number) => (hasPrev ? v : null);

  // Linhas por perfil (ou só o selecionado)
  const lines = (account ? [account] : ig.accounts);
  const dates = ig.daily.map((d) => d.date);
  const series = dates.map((date) => {
    const row: Record<string, string | number> = { label: shortDate(date), tip: tipDate(date) };
    lines.forEach((a) => (row[a.id] = a.daily.find((d) => d.date === date)?.views ?? 0));
    return row;
  });

  const catSlices = CATEGORY_ORDER.map((c) => ({ name: CATEGORY_LABEL[c], value: totals.viewsByCategory[c as ContentCategory] ?? 0, color: CATEGORY_COLOR[c] }));
  const posts = ig.topPosts.filter((p) => !account || p.account_id === account.id).slice(0, 6);
  const pdfAccount = account?.id ?? ig.accounts[0]?.id ?? "";
  const interactionBars = [
    { label: "Curtidas", value: totals.likes, color: "#e0556b" },
    { label: "Comentários", value: totals.comments, color: BRAND.steel },
    { label: "Compartilhamentos", value: totals.shares, color: BRAND.green },
    { label: "Salvamentos", value: totals.saves, color: BRAND.yellow },
  ].filter((i) => i.value > 0);

  if (!ig.has) {
    return (
      <Card className="p-10 text-center text-sm text-gray-500">
        Sem dados do Instagram neste período{ig.from ? ` — o histórico sincronizado começa em ${shortDate(ig.from)}/${ig.from.slice(0, 4)}` : ""}.
        Abra a aba Instagram e clique em “Atualizar agora” para sincronizar.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Chip active={acc === "all"} onClick={() => setAcc("all")}>Todos os perfis</Chip>
          {ig.accounts.map((a, i) => (
            <Chip key={a.id} active={acc === a.id} color={ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]} onClick={() => setAcc(a.id)}>{a.label}</Chip>
          ))}
        </div>
        <div className="flex gap-2">
          <Link href="/instagram" className="flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-blue-900 hover:border-blue-900">
            Dashboard completa <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <a
            href={`/relatorio/instagram?account=${pdfAccount}&period=custom&from=${range.from}&to=${range.to}&print=1`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-full bg-yellow-500 px-3 py-1.5 text-xs font-bold text-blue-900 hover:bg-yellow-600"
            title={period === "custom" ? undefined : "PDF detalhado do perfil no mesmo período"}
          >
            <FileDown className="h-3.5 w-3.5" /> PDF do perfil
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Visualizações" icon={Eye} value={fmt(totals.views)} current={totals.views} previous={pv(prev.views)} spark={(account ?? { daily: ig.daily }).daily.map((d) => d.views)} color={BRAND.blue} />
        <Kpi label="Alcance" icon={ScanEye} value={fmt(totals.reach)} current={totals.reach} previous={pv(prev.reach)} color={BRAND.steel} hint="Soma diária" />
        <Kpi label="Interações" icon={Heart} value={fmt(totals.interactions)} current={totals.interactions} previous={pv(prev.interactions)} color={BRAND.green} />
        <Kpi label="Engajamento" icon={Target} value={pct1(er)} current={er} previous={pv(prevEr)} hint="Interações ÷ alcance" color="#8b5fbf" />
        <Kpi label="Seguidores" icon={Users} value={followers != null ? fmt(followers) : "—"} hint="Agora" color={BRAND.blue} />
        <Kpi label="Seguidores líquidos" icon={UserPlus} value={signed(totals.netFollowers)} hint="Até 30 dias de histórico" color={BRAND.yellow} />
        <Kpi label="Visitas ao perfil" icon={MousePointerClick} value={fmt(totals.profileViews)} current={totals.profileViews} previous={pv(prev.profileViews)} color="#2a9d8f" />
        <Kpi label="Cliques no link" icon={Link2} value={fmt(totals.websiteClicks)} current={totals.websiteClicks} previous={pv(prev.websiteClicks)} hint={`${fmt(pubs)} publicações · ${fmt(stories)} stories`} color="#e07b39" />
      </div>

      <Panel title="Visualizações por dia" subtitle={`${label}${lines.length > 1 ? " — uma linha por perfil" : ""}`}>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={series} margin={{ left: -10, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} minTickGap={16} />
            <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
            <RTooltip content={<ChartTooltip />} />
            {lines.map((a) => {
              const idx = ig.accounts.findIndex((x) => x.id === a.id);
              return <Line key={a.id} isAnimationActive={false} type="monotone" dataKey={a.id} name={a.label} stroke={ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length]} strokeWidth={2.5} dot={false} />;
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Visualizações por tipo" subtitle="De onde vem a audiência">
          <Donut data={catSlices} centerLabel="visualizações" centerValue={compact(totals.views)} />
        </Panel>
        <Panel title="Seguidores × não seguidores" subtitle="Quem assiste ao conteúdo">
          <Donut
            data={[
              { name: "Seguidores", value: totals.viewsFollowers, color: BRAND.blue },
              { name: "Não seguidores", value: totals.viewsNonFollowers, color: BRAND.yellow },
            ]}
            centerLabel="visualizações"
            centerValue={compact(totals.views)}
          />
        </Panel>
        <Panel title="Interações" subtitle={`${fmt(totals.interactions)} no período`}>
          <BarList items={interactionBars} total={totals.interactions} />
        </Panel>
      </div>

      <Panel title="Comparativo dos perfis" subtitle={label}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                <th className="pb-2">Perfil</th>
                <th className="pb-2 text-right">Seguidores</th>
                <th className="pb-2 text-right">Visualizações</th>
                <th className="pb-2 text-right">Alcance</th>
                <th className="pb-2 text-right">Interações</th>
                <th className="pb-2 text-right">Seg. líquidos</th>
                <th className="pb-2 text-right">Publicações</th>
              </tr>
            </thead>
            <tbody>
              {ig.accounts.map((a) => (
                <tr key={a.id} onClick={() => setAcc(a.id)} className={cn("cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-050", acc === a.id && "bg-yellow-050")}>
                  <td className="py-2.5 font-semibold text-blue-900">{a.label}</td>
                  <td className="py-2.5 text-right">{a.followers != null ? fmt(a.followers) : "—"}</td>
                  <td className="py-2.5 text-right"><span className="font-bold text-blue-900">{fmt(a.totals.views)}</span> <Delta cur={a.totals.views} prev={a.hasPrevious ? a.prev.views : null} /></td>
                  <td className="py-2.5 text-right">{fmt(a.totals.reach)}</td>
                  <td className="py-2.5 text-right">{fmt(a.totals.interactions)}</td>
                  <td className="py-2.5 text-right">{signed(a.totals.netFollowers)}</td>
                  <td className="py-2.5 text-right">{fmt(a.pubs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Publicações em destaque" subtitle="Feed e reels com mais visualizações no período">
        {posts.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Sem publicações sincronizadas neste período.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {posts.map((m, i) => (
              <a key={m.media_id} href={m.permalink ?? undefined} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-gray-200 transition-shadow hover:shadow-[var(--shadow-md)]">
                <div className="relative aspect-square bg-gray-100">
                  <Thumb url={m.thumbnail_url} />
                  <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 text-xs font-bold text-blue-900 shadow">{i + 1}</span>
                  <span className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: CATEGORY_COLOR[categoryFromMedia(m)] }}>{CATEGORY_LABEL[categoryFromMedia(m)]}</span>
                </div>
                <div className="space-y-1 p-2.5">
                  <p className="line-clamp-2 min-h-[2rem] text-[11px] leading-snug text-gray-700">{m.caption || "Sem legenda"}</p>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-blue-900">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3 text-gray-400" />{compact(m.views)}</span>
                    <span className="flex items-center gap-1"><Send className="h-3 w-3 text-gray-400" />{compact(m.shares)}</span>
                    <span>{pct1(engagementRate(m.total_interactions, m.reach))}</span>
                  </div>
                  {ig.accounts.length > 1 && <p className="truncate text-[10px] text-gray-400">{m.accountLabel}</p>}
                </div>
              </a>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
