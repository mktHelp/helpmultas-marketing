import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/PageHeader";
import { RealtimeRefresher } from "@/components/shared/RealtimeRefresher";
import { ReportsHub } from "@/components/reports/ReportsHub";
import { loadReportsData } from "@/lib/services/reports";

export const dynamic = "force-dynamic";

// Relatórios do Marketing: visão geral (Instagram + Tráfego + Produção) e uma
// aba por frente, com período livre, exportação em CSV e PDF.
export default async function ReportsPage() {
  const supabase = await createClient();
  const raw = await loadReportsData(supabase);

  return (
    <div>
      <RealtimeRefresher tables={["tasks", "task_assignees"]} />
      <PageHeader
        title="Relatórios"
        description="Tudo do Marketing em um lugar: produção, Instagram e tráfego pago — juntos ou separados."
      />
      <ReportsHub raw={raw} />
    </div>
  );
}
