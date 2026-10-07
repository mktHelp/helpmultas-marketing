"use client";

import { useEffect, useState } from "react";
import { Home, Store } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { ExpansionCreativesTable } from "@/components/expansion/ExpansionCreativesTable";
import { EXPANSION_SECTIONS, useAllowedSections, useExpansionSection } from "@/components/expansion/ExpansionNav";
import { TrafficAdsTable } from "@/components/ads/TrafficAdsTable";
import { TrafficDashboard } from "@/components/ads/TrafficDashboard";
import { TrafficLeads } from "@/components/ads/TrafficLeads";
import { ExpansionDre } from "@/components/expansion/dre/ExpansionDre";
import { SyncButton } from "@/components/ads/SyncButton";
import { MODELO_LABEL, type Modelo } from "@/lib/expansion/dre";

// A navegação fica no cabeçalho (desktop) e na barra inferior (celular);
// aqui só se renderiza a seção escolhida na URL.
export function ExpansionTabs() {
  const section = useExpansionSection();
  const allowed = useAllowedSections();
  const current = EXPANSION_SECTIONS[section];
  const [modelo, setModelo] = useState<Modelo | null>(null);

  // O título da aba do navegador acompanha a seção aberta (antes ficava sempre "Criativos").
  useEffect(() => {
    document.title = `${current.label} — Expansão Help Multas`;
  }, [current.label]);

  if (allowed.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
        Nenhuma aba foi liberada para o seu usuário. Fale com o Master para pedir acesso.
      </div>
    );
  }

  return (
    <div>
      <div className={section === "dre" ? "print:hidden" : undefined}>
      <PageHeader
        icon={current.icon}
        title={current.title}
        description={current.description}
        action={
          section === "dre" ? (
            modelo ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-yellow-500 px-4 py-2 text-sm font-bold text-blue-900 shadow-lg">
                {modelo === "loja" ? <Store className="h-4 w-4" /> : <Home className="h-4 w-4" />} Modelo {MODELO_LABEL[modelo]}
              </span>
            ) : undefined
          ) : section !== "creatives" ? (
            <SyncButton />
          ) : undefined
        }
      />
      </div>

      <div key={section} className="ast-fade-up">
        {section === "creatives" && <ExpansionCreativesTable />}
        {section === "traffic" && <TrafficAdsTable />}
        {section === "dashboard" && <TrafficDashboard />}
        {section === "leads" && <TrafficLeads />}
        {section === "dre" && <ExpansionDre onModelo={setModelo} />}
      </div>
    </div>
  );
}
