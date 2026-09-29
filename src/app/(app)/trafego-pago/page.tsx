import { PageHeader } from "@/components/shared/PageHeader";
import { TrafficAdsTable } from "@/components/ads/TrafficAdsTable";

export default function TrafficPage() {
  return (
    <div>
      <PageHeader
        title="Tráfego Pago"
        description="Campanhas, conjuntos e anúncios sincronizados do Gerenciador de Anúncios da Meta. Somente leitura."
      />
      <TrafficAdsTable />
    </div>
  );
}
