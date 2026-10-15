import { PageHeader } from "@/components/shared/PageHeader";
import { LeadReconciliation } from "@/components/ads/LeadReconciliation";

export default function LeadValidationPage() {
  return (
    <div>
      <PageHeader
        title="Validação de leads"
        description="A cada 3h, compara os leads da LP e do formulário nativo com o que o CRM exportou: quem ficou fora e quem está duplicado."
      />
      <LeadReconciliation />
    </div>
  );
}
