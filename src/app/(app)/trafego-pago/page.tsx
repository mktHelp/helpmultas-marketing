import { TrendingUp } from "lucide-react";
import { PageHero } from "@/components/shared/PageHero";
import { TrafficAdsTable } from "@/components/ads/TrafficAdsTable";
import { SyncButton } from "@/components/ads/SyncButton";

export default function TrafficPage() {
  return (
    <div>
      <PageHero
        tone="traffic"
        icon={TrendingUp}
        title="Tráfego Pago"
        description="Campanhas, conjuntos e anúncios sincronizados do Gerenciador de Anúncios da Meta. Somente leitura."
        action={<SyncButton />}
      />
      <TrafficAdsTable />
    </div>
  );
}
