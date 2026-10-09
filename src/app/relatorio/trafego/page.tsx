import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";
import { TrafficReport } from "@/components/ads/TrafficReport";
import { loadLandingLeads, loadTrafficStructure } from "@/lib/services/meta-ads";
import { isDateKey, isPeriodKey, periodLabel, rangeForPreset, rangeLength, shiftDate, todayBRT, type PeriodKey } from "@/lib/period";

export const metadata: Metadata = { title: "Relatório de Tráfego Pago" };
export const dynamic = "force-dynamic";

// Fica fora do shell do Hub (sem sidebar/topbar) pra imprimir só o relatório.
// Exige login e bloqueia o perfil "expansao", igual ao (app)/layout.
export default async function TrafficReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; campaign?: string; print?: string }>;
}) {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user) redirect("/login?redirectTo=/relatorio/trafego");
  if (profile?.role === "expansao") redirect("/expansao");

  const params = await searchParams;
  const period: PeriodKey = isPeriodKey(params.period) ? params.period : "30";
  const today = todayBRT();
  const custom = {
    from: isDateKey(params.from) ? params.from : shiftDate(today, -7),
    to: isDateKey(params.to) ? params.to : shiftDate(today, -1),
  };
  const range = rangeForPreset(period, custom, today);
  const length = rangeLength(range);
  const prevRange = { from: shiftDate(range.from, -length), to: shiftDate(range.from, -1) };

  const supabase = await createClient();
  const [structure, leads, prevLeads, account] = await Promise.all([
    loadTrafficStructure(supabase),
    loadLandingLeads(supabase, range.from, range.to).catch(() => []),
    loadLandingLeads(supabase, prevRange.from, prevRange.to).catch(() => []),
    supabase.from("meta_ad_accounts").select("name").limit(1).maybeSingle(),
  ]);

  // `campaign` aceita vários ids separados por vírgula (filtro múltiplo do dashboard).
  const campaignIds = (params.campaign ?? "").split(",").filter((id) => structure.campaigns.some((c) => c.id === id));

  return (
    <TrafficReport
      accountName={(account.data?.name as string | undefined) || "Conta de anúncios"}
      period={period}
      range={range}
      prevRange={prevRange}
      periodText={periodLabel(period, range)}
      lengthDays={length}
      campaignIds={campaignIds}
      campaigns={structure.campaigns.map((c) => ({ id: c.id, name: c.name, budget: c.daily_budget, active: c.active_in_meta }))}
      adSets={structure.adSets.map((a) => ({ id: a.id, campaign_id: a.campaign_id }))}
      ads={structure.ads.map((a) => ({ id: a.id, adset_id: a.adset_id, name: a.name, thumbnail_url: a.thumbnail_url }))}
      // Só o que o relatório usa (período + anterior) — a base toda não precisa ir pro navegador.
      insights={structure.insights.filter((r) => r.date >= prevRange.from && r.date <= range.to)}
      minDate={structure.minDate}
      leads={leads}
      prevLeads={prevLeads}
      generatedAt={new Date().toISOString()}
      autoPrint={params.print === "1"}
    />
  );
}
