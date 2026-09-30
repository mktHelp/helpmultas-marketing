import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";
import { ExecutiveReport, type ExecSection } from "@/components/reports/ExecutiveReport";
import { loadReportsData } from "@/lib/services/reports";
import { isReportPeriodKey, reportRange, type ReportPeriodKey } from "@/lib/report-period";
import { isDateKey, shiftDate, todayBRT } from "@/lib/period";

export const metadata: Metadata = { title: "Relatório de Marketing" };
export const dynamic = "force-dynamic";

const ALL: ExecSection[] = ["instagram", "trafego", "tarefas"];

// Fora do shell do Hub (sem sidebar/topbar) pra imprimir só o relatório.
// Exige login e bloqueia o perfil "expansao", igual ao (app)/layout.
export default async function ExecutiveReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; sections?: string; print?: string }>;
}) {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user) redirect("/login?redirectTo=/relatorio/geral");
  if (profile?.role === "expansao") redirect("/expansao");

  const params = await searchParams;
  const period: ReportPeriodKey = isReportPeriodKey(params.period) ? params.period : "30";
  const today = todayBRT();
  const custom = {
    from: isDateKey(params.from) ? params.from : shiftDate(today, -30),
    to: isDateKey(params.to) ? params.to : shiftDate(today, -1),
  };
  const range = reportRange(period, custom, today);
  const requested = (params.sections ?? "").split(",").filter((s): s is ExecSection => (ALL as string[]).includes(s));
  const sections = requested.length ? ALL.filter((s) => requested.includes(s)) : ALL;

  const supabase = await createClient();
  const raw = await loadReportsData(supabase);

  return (
    <ExecutiveReport
      raw={raw}
      period={period}
      range={range}
      sections={sections}
      generatedAt={new Date().toISOString()}
      autoPrint={params.print === "1"}
    />
  );
}
