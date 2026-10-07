import { PageHeader } from "@/components/shared/PageHeader";
import { TrafficLeads } from "@/components/ads/TrafficLeads";
import { SyncButton } from "@/components/ads/SyncButton";

export default function TrafficLeadsPage() {
  return (
    <div>
      <PageHeader
        title="Leads"
        description="Leads recebidos da Landing Page com rastreamento de anúncio de origem via UTM."
        action={<SyncButton />}
      />
      <TrafficLeads />
    </div>
  );
}
