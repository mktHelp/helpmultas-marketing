"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Bot, Calculator, Contact, LayoutDashboard, Megaphone, TrendingUp, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { hasTab } from "@/lib/access";
import { SidebarHelpinho, SidebarLink, SidebarSectionTitle, type TipHandlers } from "@/components/layout/SidebarParts";

export const EXPANSION_SECTIONS = {
  dashboard: {
    label: "Dashboard",
    icon: LayoutDashboard,
    title: "Dashboard de Tráfego Pago",
    description: "KPIs do Gerenciador de Anúncios da Meta e ranking dos criativos vinculados. Somente leitura.",
    tone: "traffic",
  },
  creatives: {
    label: "Criativos",
    icon: Megaphone,
    title: "Criativos da Franqueadora",
    description: "Anúncios produzidos pelo Marketing, para rastrear a origem dos leads. Atualizado em tempo real.",
    tone: "blue",
  },
  traffic: {
    label: "Tráfego Pago",
    icon: TrendingUp,
    title: "Tráfego Pago",
    description: "Campanhas, conjuntos e anúncios sincronizados do Gerenciador de Anúncios da Meta. Somente leitura.",
    tone: "traffic",
  },
  leads: {
    label: "Leads",
    icon: Contact,
    title: "Leads",
    description: "Leads recebidos da Landing Page com rastreamento de anúncio de origem via UTM.",
    tone: "traffic",
  },
  dre: {
    label: "DRE",
    icon: Calculator,
    title: "Simulado de DRE",
    description: "Simule a DRE com a realidade do lead — mercado, ticket, investimento e despesas — e mostre o retorno em 36 meses.",
    tone: "blue",
  },
} as const satisfies Record<string, { label: string; icon: LucideIcon; title: string; description: string; tone: "blue" | "traffic" }>;

export type ExpansionSectionKey = keyof typeof EXPANSION_SECTIONS;

const KEYS = Object.keys(EXPANSION_SECTIONS) as ExpansionSectionKey[];

// Itens da navegação: as seções (abas de /expansao) + o chat do Helpinho (página própria).
export const ASSISTANT_PATH = "/expansao/assistente";
const NAV_ITEMS = [
  ...KEYS.map((key) => ({
    id: key as string,
    label: EXPANSION_SECTIONS[key].label,
    icon: EXPANSION_SECTIONS[key].icon as LucideIcon,
    href: `/expansao?aba=${key}`,
  })),
  { id: "assistant", label: "Helpinho", icon: Bot as LucideIcon, href: ASSISTANT_PATH },
];

const ALL_SECTION_ITEMS = NAV_ITEMS.filter((i) => i.id !== "assistant");

export function useActiveNavId(): string {
  const pathname = usePathname();
  const section = useExpansionSection();
  return pathname.startsWith(ASSISTANT_PATH) ? "assistant" : section;
}

// A aba ativa vive na URL (?aba=leads): link compartilhável, botão voltar
// funciona e o cabeçalho e a barra inferior ficam sempre em sincronia.
export function useExpansionSection(): ExpansionSectionKey {
  const param = useSearchParams().get("aba");
  const allowed = useAllowedSections();
  if (KEYS.includes(param as ExpansionSectionKey) && allowed.includes(param as ExpansionSectionKey)) return param as ExpansionSectionKey;
  return allowed[0] ?? "dashboard";
}

/** Abas da Expansão liberadas para o usuário logado (profiles.allowed_tabs). */
export function useAllowedSections(): ExpansionSectionKey[] {
  const { profile } = useAuth();
  return KEYS.filter((k) => hasTab(profile, `exp:${k}`));
}

/** Navegação lateral (desktop): mesmas peças e visual da sidebar do Hub. */
export function ExpansionSideNav({ collapsed, tip, onNavigate }: { collapsed: boolean; tip: TipHandlers; onNavigate?: () => void }) {
  const active = useActiveNavId();
  const allowed = useAllowedSections();
  const items = ALL_SECTION_ITEMS.filter((i) => allowed.includes(i.id as ExpansionSectionKey));

  return (
    <>
      <SidebarSectionTitle title="Painel" collapsed={collapsed} />
      <div className="space-y-0.5">
        {items.map(({ id, label, icon, href }, i) => (
          <SidebarLink key={id} item={{ href, label, icon }} active={id === active} collapsed={collapsed} onNavigate={onNavigate} tip={tip} index={i} />
        ))}
      </div>
    </>
  );
}

/** Helpinho no topo da sidebar (precisa da rota ativa, por isso fica separado e dentro de Suspense). */
export function ExpansionHelpinho({ collapsed, tip, onNavigate }: { collapsed: boolean; tip: TipHandlers; onNavigate?: () => void }) {
  const active = useActiveNavId();
  return <SidebarHelpinho href={ASSISTANT_PATH} active={active === "assistant"} collapsed={collapsed} onNavigate={onNavigate} tip={tip} />;
}
