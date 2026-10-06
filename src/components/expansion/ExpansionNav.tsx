"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bot, Calculator, Contact, Sparkles, LayoutDashboard, Megaphone, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { hasTab } from "@/lib/access";

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
    title: "DRE do Franqueado",
    description: "Simule a DRE com a realidade do lead — mercado, ticket, investimento e despesas — e mostre o retorno em 36 meses.",
    tone: "blue",
  },
} as const satisfies Record<string, { label: string; icon: LucideIcon; title: string; description: string; tone: "blue" | "traffic" }>;

export type ExpansionSectionKey = keyof typeof EXPANSION_SECTIONS;

const KEYS = Object.keys(EXPANSION_SECTIONS) as ExpansionSectionKey[];

// Itens da navegação: as seções (abas de /expansao) + o chat do Helpinho (página própria).
const ASSISTANT_PATH = "/expansao/assistente";
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
const ASSISTANT_ITEM = NAV_ITEMS.find((i) => i.id === "assistant")!;

function useActiveNavId(): string {
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

/** Navegação lateral (desktop): vai dentro da sidebar azul. */
export function ExpansionSideNav({ collapsed = false }: { collapsed?: boolean }) {
  const active = useActiveNavId();
  const allowed = useAllowedSections();
  const SECTION_ITEMS = ALL_SECTION_ITEMS.filter((i) => allowed.includes(i.id as ExpansionSectionKey));

  return (
    <nav aria-label="Seções da Expansão" className="flex flex-col gap-1">
      {SECTION_ITEMS.map(({ id, label, icon: Icon, href }, i) => {
        const isActive = id === active;
        return (
          <Link
            key={id}
            href={href}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            title={collapsed ? label : undefined}
            style={{ animation: "ast-slide-in-left 280ms both", animationDelay: `${i * 40}ms` }}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-2 py-2 text-sm font-semibold transition-colors",
              collapsed && "justify-center",
              isActive ? "bg-white/15 text-white" : "text-blue-100 hover:bg-white/10 hover:text-white"
            )}
          >
            {isActive && <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-yellow-500" aria-hidden />}
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-transform group-hover:scale-110",
                isActive ? "bg-yellow-500 text-blue-900" : "bg-white/10"
              )}
            >
              <Icon className="h-[17px] w-[17px]" />
            </span>
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        );
      })}

      {/* Helpinho em destaque */}
      <div className="mt-3 border-t border-white/10 pt-4">
        <Link
          href={ASSISTANT_ITEM.href}
          aria-current={active === "assistant" ? "page" : undefined}
          title={collapsed ? "Helpinho — assistente de IA" : undefined}
          className={cn(
            "group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-400 text-blue-900 shadow-lg shadow-yellow-500/20 transition-transform hover:-translate-y-0.5",
            collapsed ? "justify-center p-2" : "p-3",
            active === "assistant" && "ring-2 ring-white/70"
          )}
        >
          <span className="pointer-events-none absolute -right-4 -top-6 h-16 w-16 rounded-full bg-white/30 blur-xl" aria-hidden />
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-900 text-yellow-500 transition-transform group-hover:rotate-6">
            <Bot className="h-5 w-5" />
          </span>
          {!collapsed && (
            <span className="relative min-w-0 flex-1 leading-tight">
              <span className="flex items-center gap-1.5 text-sm font-bold">
                Helpinho
                <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-900 px-1.5 py-0.5 text-[10px] font-bold text-yellow-500">
                  <Sparkles className="h-2.5 w-2.5" /> IA
                </span>
              </span>
              <span className="block truncate text-[11px] font-semibold text-blue-900/70">Tire dúvidas e peça ajuda</span>
            </span>
          )}
        </Link>
      </div>
    </nav>
  );
}

/** Barra fixa embaixo (celular), com ícone e nome de cada seção. */
export function ExpansionBottomNav() {
  const active = useActiveNavId();
  const allowed = useAllowedSections();
  const SECTION_ITEMS = ALL_SECTION_ITEMS.filter((i) => allowed.includes(i.id as ExpansionSectionKey));
  const half = Math.ceil(SECTION_ITEMS.length / 2);

  return (
    <nav
      aria-label="Seções da Expansão"
      className="fixed inset-x-0 bottom-0 z-40 print:!hidden border-t border-gray-200 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-md items-end" style={{ gridTemplateColumns: `repeat(${SECTION_ITEMS.length + 1}, minmax(0, 1fr))` }}>
        {[...SECTION_ITEMS.slice(0, half), ASSISTANT_ITEM, ...SECTION_ITEMS.slice(half)].map(({ id, label, icon: Icon, href }) => {
          const isActive = id === active;
          if (id === "assistant") {
            return (
              <Link
                key={id}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className="flex flex-col items-center gap-0.5 pb-2 text-[11px] font-bold text-blue-900"
              >
                <span
                  className={cn(
                    "-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500 to-amber-400 text-blue-900 shadow-lg shadow-yellow-500/40 ring-4 ring-white",
                    isActive && "ring-blue-900/20"
                  )}
                >
                  <Bot className="h-6 w-6" />
                </span>
                {label}
              </Link>
            );
          }
          return (
            <Link
              key={id}
              href={href}
              scroll={false}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition-colors",
                isActive ? "text-blue-900" : "text-gray-500"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                  isActive ? "bg-yellow-500 text-blue-900" : "bg-transparent"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
