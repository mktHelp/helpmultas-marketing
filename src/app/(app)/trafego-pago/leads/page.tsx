import { Contact } from "lucide-react";
import { PageHero } from "@/components/shared/PageHero";
import { TrafficLeads } from "@/components/ads/TrafficLeads";
import { SyncButton } from "@/components/ads/SyncButton";

export default function TrafficLeadsPage() {
  return (
    <div>
      <PageHero
        tone="traffic"
        icon={Contact}
        title="Leads"
        description="Leads recebidos da Landing Page com rastreamento de anúncio de origem via UTM."
        action={<SyncButton />}
      />
      <TrafficLeads />
    </div>
  );
}
