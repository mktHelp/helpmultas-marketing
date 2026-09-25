import { PageHeader } from "@/components/shared/PageHeader";
import { ExpansionCreativesTable } from "@/components/expansion/ExpansionCreativesTable";

export default function ExpansionCreativesPage() {
  return (
    <div>
      <PageHeader
        title="Criativos da Franqueadora"
        description="Anúncios produzidos pelo Marketing, para rastrear a origem dos leads. Atualizado em tempo real."
      />
      <ExpansionCreativesTable />
    </div>
  );
}
