import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";
import { InstagramReport } from "@/components/instagram/InstagramReport";
import { listSocialAccounts, listRecentFollowerSnapshots } from "@/lib/services/social";
import {
  isDateKey, isPeriodKey, listInstagramAudience, listInstagramInsights, listInstagramMedia, mediaInRange,
  periodLabel, rangeForPreset, rangeLength, shiftDate, sliceByRange, todayBRT, type PeriodKey,
} from "@/lib/services/instagram";
import type { InstagramProfileInfo } from "@/types/database";

export const metadata: Metadata = { title: "Relatório de Insights — Instagram" };
export const dynamic = "force-dynamic";

// Fica fora do shell do Hub (sem sidebar/topbar) pra imprimir só o relatório.
// Exige login e bloqueia o perfil "expansao", igual ao (app)/layout.
export default async function InstagramReportPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; period?: string; from?: string; to?: string; days?: string; print?: string }>;
}) {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user) redirect("/login?redirectTo=/relatorio/instagram");
  if (profile?.role === "expansao") redirect("/expansao");

  const params = await searchParams;
  const supabase = await createClient();
  const [accountsAll, insights, media, audience, snapshots] = await Promise.all([
    listSocialAccounts(supabase),
    listInstagramInsights(supabase),
    listInstagramMedia(supabase),
    listInstagramAudience(supabase),
    listRecentFollowerSnapshots(supabase, 3),
  ]);

  const accounts = accountsAll.filter((a) => a.platform === "instagram");
  const account = accounts.find((a) => a.id === params.account) ?? accounts[0];
  if (!account) redirect("/instagram");

  // `days` = link antigo (?days=30); o atual usa ?period=&from=&to=.
  const legacy = params.days && isPeriodKey(params.days) ? params.days : undefined;
  const period: PeriodKey = isPeriodKey(params.period) ? params.period : (legacy ?? "30");
  const today = todayBRT();
  const custom = {
    from: isDateKey(params.from) ? params.from : shiftDate(today, -7),
    to: isDateKey(params.to) ? params.to : shiftDate(today, -1),
  };
  const range = rangeForPreset(period, custom, today);

  const accountInsights = insights.filter((i) => i.account_id === account.id);
  const slices = sliceByRange(accountInsights, range);
  const accountMedia = media.filter((m) => m.account_id === account.id);
  const periodMedia = mediaInRange(accountMedia, range);
  const prevMedia = mediaInRange(accountMedia, slices.prevRange);

  const accountAudience = audience.filter((a) => a.account_id === account.id);
  const profileInfo = (accountAudience.find((a) => a.kind === "profile")?.data ?? {}) as InstagramProfileInfo;
  const latestSnapshot = snapshots
    .filter((s) => s.account_id === account.id)
    .sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0];
  const followersNow = latestSnapshot?.followers_count ?? profileInfo.followers_count ?? null;
  const lastSync = [...accountInsights.map((r) => r.synced_at), ...accountAudience.map((r) => r.synced_at)].sort().pop() ?? "";

  return (
    <InstagramReport
      accountId={account.id}
      accounts={accounts.map((a) => ({ id: a.id, label: a.label }))}
      period={period}
      range={range}
      prevRange={slices.prevRange}
      periodText={periodLabel(period, range)}
      lengthDays={rangeLength(range)}
      generatedAt={new Date().toISOString()}
      profile={{ ...profileInfo, username: profileInfo.username ?? account.ig_username ?? undefined }}
      rows={slices.current}
      prevRows={slices.previous}
      hasPrevious={slices.hasPrevious}
      media={periodMedia}
      prevMedia={prevMedia}
      audience={accountAudience}
      followersNow={followersNow}
      lastSync={lastSync}
      autoPrint={params.print === "1"}
    />
  );
}
