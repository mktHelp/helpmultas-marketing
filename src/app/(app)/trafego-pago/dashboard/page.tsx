import { LayoutDashboard } from "lucide-react";
import { PageHero } from "@/components/shared/PageHero";
import { TrafficDashboard } from "@/components/ads/TrafficDashboard";
import { SyncButton } from "@/components/ads/SyncButton";

export default function TrafficDashboardPage() {
  return (
    <div>
      <PageHero
        tone="traffic"
        icon={LayoutDashboard}
        title="Dashboard de Tráfego Pago"
        description="KPIs do Gerenciador de Anúncios da Meta e ranking dos criativos vinculados. Somente leitura."
        action={<SyncButton />}
      />
      <TrafficDashboard />
    </div>
  );
}
