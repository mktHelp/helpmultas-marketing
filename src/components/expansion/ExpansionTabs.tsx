"use client";

import { PageHero } from "@/components/shared/PageHero";
import { ExpansionCreativesTable } from "@/components/expansion/ExpansionCreativesTable";
import { EXPANSION_SECTIONS, useExpansionSection } from "@/components/expansion/ExpansionNav";
import { TrafficAdsTable } from "@/components/ads/TrafficAdsTable";
import { TrafficDashboard } from "@/components/ads/TrafficDashboard";
import { TrafficLeads } from "@/components/ads/TrafficLeads";
import { SyncButton } from "@/components/ads/SyncButton";

// A navegação fica no cabeçalho (desktop) e na barra inferior (celular);
// aqui só se renderiza a seção escolhida na URL.
export function ExpansionTabs() {
  const section = useExpansionSection();
  const current = EXPANSION_SECTIONS[section];

  return (
    <div>
      <PageHero
        tone={current.tone}
        icon={current.icon}
        title={current.title}
        description={current.description}
        action={section !== "creatives" ? <SyncButton /> : undefined}
      />

      <div key={section} className="ast-fade-up">
        {section === "creatives" && <ExpansionCreativesTable />}
        {section === "traffic" && <TrafficAdsTable />}
        {section === "dashboard" && <TrafficDashboard />}
        {section === "leads" && <TrafficLeads />}
      </div>
    </div>
  );
}
