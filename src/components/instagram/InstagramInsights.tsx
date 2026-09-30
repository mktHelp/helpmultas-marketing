"use client";

import { useMemo, useState } from "react";
import { AtSign } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { numberFormatter } from "@/lib/format";
import { sumInsights } from "@/lib/services/instagram";
import { socialFollowerDeltas, socialLinkClickCounts } from "@/lib/stats";
import type { InstagramDailyInsight, SocialAccount, SocialFollowerSnapshot, SocialLinkClick } from "@/types/database";

const PERIODS = [
  { key: "7", label: "7 dias" },
  { key: "14", label: "14 dias" },
  { key: "30", label: "30 dias" },
];

const TYPE_LABELS: Record<string, string> = {
  REEL: "Reels",
  STORY: "Stories",
  POST: "Posts",
  CAROUSEL_CONTAINER: "Carrosséis",
  VIDEO: "Vídeos",
  AD: "Anúncios",
  LIVE: "Vídeos ao vivo",
};

const TICK_STYLE = { fontSize: 11, fill: "#7c8e98" };
const TOOLTIP_STYLE = { borderRadius: 12, border: "1px solid #d8e0e4", fontSize: 13 };

function pct(part: number, total: number) {
  return total > 0 ? ((part / total) * 100).toFixed(1).replace(".", ",") : "0,0";
}

function signed(n: number) {
  return `${n > 0 ? "+" : ""}${numberFormatter.format(n)}`;
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-blue-900">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
    </Card>
  );
}

export function InstagramInsights({
  accounts,
  insights,
  snapshots,
  linkClicks,
}: {
  accounts: SocialAccount[];
  insights: InstagramDailyInsight[];
  snapshots: SocialFollowerSnapshot[];
  linkClicks: SocialLinkClick[];
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [period, setPeriod] = useState("14");

  const rows = useMemo(() => {
    const mine = insights.filter((i) => i.account_id === accountId);
    return mine.slice(-Number(period));
  }, [insights, accountId, period]);

  const totals = useMemo(() => sumInsights(rows), [rows]);
  const followerRow = useMemo(
    () => socialFollowerDeltas(accounts, snapshots).find((r) => r.account.id === accountId) ?? null,
    [accounts, snapshots, accountId]
  );
  const followers = followerRow?.latest ?? null;
  const clickRow = useMemo(
    () => socialLinkClickCounts(accounts, linkClicks).find((r) => r.account.id === accountId) ?? null,
    [accounts, linkClicks, accountId]
  );

  if (accounts.length === 0) {
    return <EmptyState title="Nenhum perfil do Instagram configurado" />;
  }

  const typeRows = Object.entries(totals.viewsByType)
    .map(([key, value]) => ({ key, label: TYPE_LABELS[key] ?? key, value }))
    .sort((a, b) => b.value - a.value);
  const maxType = typeRows[0]?.value ?? 0;
  const chartData = rows.map((r) => ({ label: r.date.slice(8) + "/" + r.date.slice(5, 7), views: r.views }));
  const lastSync = rows.reduce((max, r) => (r.synced_at > max ? r.synced_at : max), "");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={accounts.map((a) => ({ key: a.id, label: a.label }))}
          active={accountId}
          onChange={setAccountId}
        />
        <Tabs tabs={PERIODS} active={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Seguidores"
          value={followers ? numberFormatter.format(followers.followers_count) : "—"}
          hint={followers ? "Coleta automática a cada 15 min" : "Sem coleta ainda"}
        />
        <Kpi
          label="Variação diária"
          value={followerRow?.delta != null ? signed(followerRow.delta) : "—"}
          hint="Comparado ao último dia anterior"
        />
        <Kpi
          label="Cliques no link da bio hoje"
          value={numberFormatter.format(clickRow?.today ?? 0)}
          hint="Rastreados pela LP"
        />
        <Kpi
          label="Cliques no link da bio (30 dias)"
          value={numberFormatter.format(clickRow?.total ?? 0)}
          hint="Rastreados pela LP"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Sem dados sincronizados para este perfil"
          description="Clique em “Atualizar agora”. Se der erro, o token da Meta precisa da permissão instagram_manage_insights e do perfil atribuído a ele."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Visualizações" value={numberFormatter.format(totals.views)} />
            <Kpi label="Seguidores líquidos" value={signed(totals.netFollowers)} />
            <Kpi label="Interações" value={numberFormatter.format(totals.interactions)} />
            <Kpi label="Contas alcançadas" value={numberFormatter.format(totals.reach)} />
            <Kpi label="Contas engajadas" value={numberFormatter.format(totals.accountsEngaged)} />
            <Kpi label="Visitas ao perfil" value={numberFormatter.format(totals.profileViews)} />
            <Kpi label="Cliques no link (Instagram)" value={numberFormatter.format(totals.websiteClicks)} />
          </div>

          <Card className="p-5">
            <h3 className="font-display text-[17px] font-semibold text-blue-900">Visualizações por dia</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {pct(totals.viewsFollowers, totals.views)}% seguidores · {pct(totals.viewsNonFollowers, totals.views)}% não
              seguidores
            </p>
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f4" vertical={false} />
                  <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                  <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
                  <RTooltip
                    formatter={(v) => [numberFormatter.format(Number(v ?? 0)), "Visualizações"]}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Line type="monotone" dataKey="views" stroke="#243746" strokeWidth={2.5} dot={{ r: 3, fill: "#fcbf00" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="font-display text-[17px] font-semibold text-blue-900">Visualizações por tipo de conteúdo</h3>
              <div className="mt-4 space-y-3">
                {typeRows.length === 0 && <p className="text-sm text-gray-400">Sem dados.</p>}
                {typeRows.map((t) => (
                  <div key={t.key}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-blue-900">{t.label}</span>
                      <span className="text-gray-700">{numberFormatter.format(t.value)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-yellow-500"
                        style={{ width: `${maxType ? (t.value / maxType) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="font-display text-[17px] font-semibold text-blue-900">Interações</h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  ["Curtidas", totals.likes],
                  ["Comentários", totals.comments],
                  ["Compartilhamentos", totals.shares],
                  ["Salvamentos", totals.saves],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-xl bg-gray-050 p-3">
                    <p className="text-xs font-semibold text-gray-500">{label}</p>
                    <p className="mt-0.5 text-lg font-bold text-blue-900">{numberFormatter.format(value as number)}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 flex items-center gap-1.5 text-[11px] text-gray-400">
                <AtSign className="h-3 w-3" />
                {lastSync
                  ? `Sincronizado em ${new Date(lastSync).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
                  : "Nunca sincronizado"}
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
