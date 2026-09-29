"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { ExpansionCreativesTable } from "@/components/expansion/ExpansionCreativesTable";
import { TrafficAdsTable } from "@/components/ads/TrafficAdsTable";
import { TrafficDashboard } from "@/components/ads/TrafficDashboard";
import { TrafficLeads } from "@/components/ads/TrafficLeads";

const SECTIONS = {
  dashboard: {
    label: "Dashboard",
    title: "Dashboard de Tráfego Pago",
    description: "KPIs do Gerenciador de Anúncios da Meta e ranking dos criativos vinculados. Somente leitura.",
  },
  creatives: {
    label: "Criativos",
    title: "Criativos da Franqueadora",
    description: "Anúncios produzidos pelo Marketing, para rastrear a origem dos leads. Atualizado em tempo real.",
  },
  traffic: {
    label: "Tráfego Pago",
    title: "Tráfego Pago",
    description: "Campanhas, conjuntos e anúncios sincronizados do Gerenciador de Anúncios da Meta. Somente leitura.",
  },
  leads: {
    label: "Leads",
    title: "Leads",
    description: "Leads recebidos da Landing Page com rastreamento de anúncio de origem via UTM.",
  },
} as const;

type SectionKey = keyof typeof SECTIONS;

export function ExpansionTabs() {
  const [section, setSection] = useState<SectionKey>("dashboard");
  const current = SECTIONS[section];

  return (
    <div>
      <Tabs
        className="mb-6"
        active={section}
        onChange={(key) => setSection(key as SectionKey)}
        tabs={Object.entries(SECTIONS).map(([key, value]) => ({ key, label: value.label }))}
      />

      <PageHeader title={current.title} description={current.description} />

      {section === "creatives" && <ExpansionCreativesTable />}
      {section === "traffic" && <TrafficAdsTable />}
      {section === "dashboard" && <TrafficDashboard />}
      {section === "leads" && <TrafficLeads />}
    </div>
  );
}
