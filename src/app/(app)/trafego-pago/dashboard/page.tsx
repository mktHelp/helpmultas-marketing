import { PageHeader } from "@/components/shared/PageHeader";
import { TrafficDashboard } from "@/components/ads/TrafficDashboard";
import { SyncButton } from "@/components/ads/SyncButton";

export default function TrafficDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard de Tráfego Pago"
        description="KPIs do Gerenciador de Anúncios da Meta e ranking dos criativos vinculados. Somente leitura."
        action={<SyncButton />}
      />
      <TrafficDashboard />
    </div>
  );
}
