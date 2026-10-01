"use client";

import { useMemo, useState } from "react";
import { AtSign, ExternalLink, FileDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { OverviewTab } from "@/components/instagram/OverviewTab";
import { ContentTab } from "@/components/instagram/ContentTab";
import { AudienceTab } from "@/components/instagram/AudienceTab";
import { fmt, signed } from "@/components/shared/dash-parts";
import {
  PERIOD_OPTIONS, mediaInRange, periodLabel, rangeForPreset, shiftDate, sliceByRange, sumInsights, todayBRT,
  type DateRange, type PeriodKey,
} from "@/lib/services/instagram";
import { socialFollowerDeltas, socialLinkClickCounts } from "@/lib/stats";
import type {
  InstagramAudienceRow, InstagramDailyInsight, InstagramMedia, InstagramProfileInfo, SocialAccount,
  SocialFollowerSnapshot, SocialLinkClick,
} from "@/types/database";

const SECTIONS = [
  { key: "overview", label: "Visão geral" },
  { key: "content", label: "Conteúdo" },
  { key: "audience", label: "Público" },
];

function DateField({
  label, value, min, max, onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 font-semibold text-gray-700">
      {label}
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="h-9 rounded-[14px] border border-gray-200 bg-white px-3 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-yellow-500"
      />
    </label>
  );
}

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function InstagramInsights({
  accounts,
  insights,
  media,
  audience,
  snapshots,
  linkClicks,
}: {
  accounts: SocialAccount[];
  insights: InstagramDailyInsight[];
  media: InstagramMedia[];
  audience: InstagramAudienceRow[];
  snapshots: SocialFollowerSnapshot[];
  linkClicks: SocialLinkClick[];
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [period, setPeriod] = useState<PeriodKey>("30");
  const today = useMemo(() => todayBRT(), []);
  const [custom, setCustom] = useState<DateRange>(() => ({ from: shiftDate(todayBRT(), -7), to: shiftDate(todayBRT(), -1) }));
  const [section, setSection] = useState("overview");
  const range = useMemo(() => rangeForPreset(period, custom, today), [period, custom, today]);
  const label = periodLabel(period, range);

  const account = accounts.find((a) => a.id === accountId);
  const accountInsights = useMemo(() => insights.filter((i) => i.account_id === accountId), [insights, accountId]);
  const accountMedia = useMemo(() => media.filter((m) => m.account_id === accountId), [media, accountId]);
  const accountAudience = useMemo(() => audience.filter((a) => a.account_id === accountId), [audience, accountId]);

  const slices = useMemo(() => sliceByRange(accountInsights, range), [accountInsights, range]);
  const periodMedia = useMemo(() => mediaInRange(accountMedia, range), [accountMedia, range]);
  const prevMedia = useMemo(() => mediaInRange(accountMedia, slices.prevRange), [accountMedia, slices.prevRange]);
  const earliest = accountInsights[0]?.date ?? "";

  const followerRow = useMemo(
    () => socialFollowerDeltas(accounts, snapshots).find((r) => r.account.id === accountId) ?? null,
    [accounts, snapshots, accountId]
  );
  const clickRow = useMemo(
    () => socialLinkClickCounts(accounts, linkClicks).find((r) => r.account.id === accountId) ?? null,
    [accounts, linkClicks, accountId]
  );
  const profileRow = accountAudience.find((a) => a.kind === "profile");
  const profile = (profileRow?.data ?? {}) as InstagramProfileInfo;
  const followersNow = followerRow?.latest?.followers_count ?? profile.followers_count ?? null;
  const lastSync = accountAudience.reduce(
    (max, r) => (r.synced_at > max ? r.synced_at : max),
    accountInsights.reduce((max, r) => (r.synced_at > max ? r.synced_at : max), "")
  );

  // Comparativo entre perfis (mesmo período)
  const comparison = useMemo(
    () =>
      accounts.map((a) => {
        const s = sliceByRange(insights.filter((i) => i.account_id === a.id), range);
        const t = sumInsights(s.current);
        const pubs = mediaInRange(media.filter((m) => m.account_id === a.id && m.product_type !== "STORY"), range).length;
        const info = (audience.find((r) => r.account_id === a.id && r.kind === "profile")?.data ?? {}) as InstagramProfileInfo;
        return { account: a, t, pubs, followers: info.followers_count ?? null, has: s.current.length > 0 };
      }),
    [accounts, insights, media, audience, range]
  );

  if (accounts.length === 0) {
    return <EmptyState title="Nenhum perfil do Instagram configurado" />;
  }

  const hasData = accountInsights.length > 0;

  return (
    <div className="space-y-5">
      {/* Perfil */}
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-900 text-lg font-bold text-white ring-2 ring-yellow-500">
          {profile.profile_picture_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.profile_picture_url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            initials(account?.label ?? "IG")
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold text-blue-900">{profile.name || account?.label}</p>
          <a
            href={`https://instagram.com/${profile.username ?? account?.ig_username ?? ""}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-blue-900"
          >
            <AtSign className="h-3.5 w-3.5" />
            {profile.username ?? account?.ig_username ?? "—"}
            <ExternalLink className="h-3 w-3" />
          </a>
          {profile.biography && <p className="mt-1 line-clamp-2 max-w-2xl whitespace-pre-line text-xs text-gray-500">{profile.biography}</p>}
        </div>
        <div className="flex gap-6 text-center">
          {[
            ["Seguidores", followersNow],
            ["Seguindo", profile.follows_count ?? null],
            ["Publicações", profile.media_count ?? null],
          ].map(([label, value]) => (
            <div key={label as string}>
              <p className="font-display text-xl font-bold text-blue-900">{value != null ? fmt(value as number) : "—"}</p>
              <p className="text-[11px] font-semibold text-gray-500">{label}</p>
            </div>
          ))}
        </div>
        {followerRow?.delta != null && (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-blue-900">{signed(followerRow.delta)} hoje</span>
        )}
      </Card>

      {/* Controles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={accounts.map((a) => ({ key: a.id, label: a.label }))} active={accountId} onChange={setAccountId} />
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              window.open(
                `/relatorio/instagram?account=${accountId}&period=${period}&from=${range.from}&to=${range.to}&print=1`,
                "_blank"
              )
            }
            disabled={!hasData}
          >
            <FileDown className="h-4 w-4" />
            Exportar PDF
          </Button>
          <Tabs tabs={SECTIONS} active={section} onChange={setSection} />
          {section !== "audience" && (
            <div className="min-w-0 max-w-full overflow-x-auto">
              <Tabs tabs={PERIOD_OPTIONS} active={period} onChange={(k) => setPeriod(k as PeriodKey)} />
            </div>
          )}
        </div>
      </div>

      {section !== "audience" && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <DateField
                label="De"
                value={custom.from}
                min={earliest || undefined}
                max={today}
                onChange={(v) => setCustom((c) => ({ ...c, from: v }))}
              />
              <DateField
                label="Até"
                value={custom.to}
                min={earliest || undefined}
                max={today}
                onChange={(v) => setCustom((c) => ({ ...c, to: v }))}
              />
            </div>
          )}
          <span className="font-semibold text-blue-900">
            {label}
            {period !== "custom" && range.from !== range.to ? ` · ${range.from.slice(8)}/${range.from.slice(5, 7)} a ${range.to.slice(8)}/${range.to.slice(5, 7)}` : ""}
          </span>
          {range.to === today && <span>· o dia de hoje é parcial (atualiza a cada sincronização)</span>}
          {earliest && range.from < earliest && (
            <span>· dados disponíveis a partir de {earliest.slice(8)}/{earliest.slice(5, 7)}/{earliest.slice(0, 4)}</span>
          )}
        </div>
      )}

      {!hasData && section !== "audience" ? (
        <EmptyState
          title="Sem dados sincronizados para este perfil"
          description="Clique em “Atualizar agora”. Se der erro, cadastre o token do perfil com npm run ig-token."
        />
      ) : (
        <>
          {section === "overview" && (
            <OverviewTab
              periodLabel={label}
              rows={slices.current}
              prevRows={slices.previous}
              hasPrevious={slices.hasPrevious}
              media={periodMedia}
              prevMedia={prevMedia}
              followersNow={followersNow}
              dailyDelta={followerRow?.delta ?? null}
              clicksToday={clickRow?.today ?? 0}
              clicksTotal={clickRow?.total ?? 0}
            />
          )}
          {section === "content" && <ContentTab media={periodMedia} />}
          {section === "audience" && <AudienceTab audience={accountAudience} followersNow={followersNow} />}
        </>
      )}

      {/* Comparativo */}
      {section === "overview" && comparison.length > 1 && (
        <Card className="overflow-x-auto p-5">
          <h3 className="font-display text-[17px] font-semibold text-blue-900">Comparativo dos perfis</h3>
          <p className="mt-0.5 text-xs text-gray-500">{label}</p>
          <table className="mt-3 w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500">
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
              {comparison.map((c) => (
                <tr
                  key={c.account.id}
                  onClick={() => setAccountId(c.account.id)}
                  className="cursor-pointer border-t border-gray-100 hover:bg-gray-050"
                >
                  <td className="py-2.5 font-semibold text-blue-900">{c.account.label}</td>
                  <td className="py-2.5 text-right">{c.followers != null ? fmt(c.followers) : "—"}</td>
                  <td className="py-2.5 text-right">{c.has ? fmt(c.t.views) : "—"}</td>
                  <td className="py-2.5 text-right">{c.has ? fmt(c.t.reach) : "—"}</td>
                  <td className="py-2.5 text-right">{c.has ? fmt(c.t.interactions) : "—"}</td>
                  <td className="py-2.5 text-right">{c.has ? signed(c.t.netFollowers) : "—"}</td>
                  <td className="py-2.5 text-right">{c.has ? fmt(c.pubs) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {lastSync && (
        <p className="text-center text-[11px] text-gray-400">
          Última sincronização: {new Date(lastSync).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
        </p>
      )}
    </div>
  );
}
