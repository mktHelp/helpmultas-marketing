import { PageHeader } from "@/components/shared/PageHeader";
import { TrafficMeetings } from "@/components/ads/TrafficMeetings";

export default function TrafficMeetingsPage() {
  return (
    <div>
      <PageHeader
        title="Reuniões"
        description="Acompanhamento do funil do CRM por lead: etapa atual, reuniões, no-show e reagendamentos, ligados à campanha de origem."
      />
      <TrafficMeetings />
    </div>
  );
}
