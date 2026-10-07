"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Sun, ListTodo, ListChecks, Kanban, Calendar,
  FolderKanban, Megaphone, FileText, Users, BarChart3, Settings, Trash2,
  Cake, AtSign, Image as ImageIcon, Mic, HandCoins, TrendingUp, Gauge, Contact, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { pathAllowed } from "@/lib/access";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  SIDEBAR_WIDTH, SidebarFrame, SidebarHelpinho, SidebarLink, SidebarSectionTitle, SidebarUser, isItemActive, useSidebarTip,
  type SidebarItem,
} from "./SidebarParts";

export { SIDEBAR_WIDTH };

const SECTIONS: { title: string; items: SidebarItem[] }[] = [
  {
    title: "Trabalho",
    items: [
      { href: "/teleprompter", label: "Teleprompter", icon: Mic },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/my-day", label: "Meu Dia", icon: Sun },
      { href: "/my-tasks", label: "Minhas Tarefas", icon: ListChecks },
      { href: "/tasks", label: "Todas as Tarefas", icon: ListTodo },
      { href: "/board", label: "Quadro", icon: Kanban },
      { href: "/calendar", label: "Calendário", icon: Calendar },
    ],
  },
  {
    title: "Planejamento",
    items: [
      { href: "/projects", label: "Projetos", icon: FolderKanban },
      { href: "/campaigns", label: "Campanhas", icon: Megaphone },
      { href: "/content", label: "Conteúdos", icon: FileText },
    ],
  },
  {
    title: "Gestão",
    items: [
      { href: "/team", label: "Equipe", icon: Users },
      { href: "/birthdays", label: "Aniversários", icon: Cake },
      { href: "/reports", label: "Relatórios", icon: BarChart3 },
    ],
  },
];

// Criativos + Gerenciador de Anúncios da Meta (somente leitura), agrupados
// à parte porque formam a mesma área de trabalho (Tráfego Pago).
const TRAFFIC_NAV: SidebarItem[] = [
  { href: "/trafego-pago/dashboard", label: "Dashboard", icon: Gauge, exact: true },
  { href: "/creatives", label: "Criativos", icon: ImageIcon },
  { href: "/trafego-pago", label: "Tráfego Pago", icon: TrendingUp, exact: true },
  { href: "/trafego-pago/leads", label: "Leads", icon: Contact, exact: true },
];

const INSTAGRAM_NAV: SidebarItem[] = [{ href: "/instagram", label: "Instagram", icon: AtSign }];

// Dashboard independente (fora deste shell), compartilhado com o time de expansão.
const AREAS_NAV: SidebarItem[] = [{ href: "/expansao", label: "Expansão", icon: HandCoins }];

const TOOLS_NAV: SidebarItem[] = [
  { href: "/trash", label: "Lixeira", icon: Trash2 },
  { href: "/settings", label: "Configurações", icon: Settings },
];

const ROLE_LABEL: Record<string, string> = { master: "Master", gestor: "Gestor", membro: "Membro", expansao: "Expansão" };

export function Sidebar({
  onNavigate,
  collapsed = false,
  animate = true,
  onToggle,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  /** liga a transição de largura (desligada no primeiro paint pra não "piscar") */
  animate?: boolean;
  /** recolher/expandir (só no desktop) */
  onToggle?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuth();
  const { tip, tipNode } = useSidebarTip(collapsed);

  // Abas liberadas para este usuário (profiles.allowed_tabs); null = tudo do papel.
  const visible = (items: SidebarItem[]) => items.filter((i) => pathAllowed(profile, i.href));
  const sections = SECTIONS.map((s) => ({ ...s, items: visible(s.items) })).filter((s) => s.items.length > 0);
  const trafficNav = visible(TRAFFIC_NAV);
  const instagramNav = visible(INSTAGRAM_NAV);
  const areasNav = visible(AREAS_NAV);
  const toolsNav = visible(TOOLS_NAV);

  const trafficActive = trafficNav.some((i) => isItemActive(pathname, i));
  const [trafficOpenManual, setTrafficOpenManual] = useState<boolean | null>(null);
  const trafficOpen = trafficOpenManual ?? trafficActive;

  // Ao navegar para dentro do grupo, reabre; ao sair, volta ao automático.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      setTrafficOpenManual(null);
    }
  }, [pathname]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  let idx = 0;
  const next = () => idx++;
  const link = (item: SidebarItem) => (
    <SidebarLink key={item.href} item={item} active={isItemActive(pathname, item)} collapsed={collapsed} onNavigate={onNavigate} tip={tip} index={next()} />
  );

  return (
    <SidebarFrame
      collapsed={collapsed}
      animate={animate}
      onToggle={onToggle}
      onClose={onNavigate}
      onNavScroll={tip.hide}
      tipNode={tipNode}
      helpinho={<SidebarHelpinho href="/assistente" active={pathname === "/assistente" || pathname.startsWith("/assistente/")} collapsed={collapsed} onNavigate={onNavigate} tip={tip} />}
      footer={
        <SidebarUser
          collapsed={collapsed}
          name={profile?.full_name}
          avatarUrl={profile?.avatar_url}
          subtitle={profile ? ROLE_LABEL[profile.role] : ""}
          profileHref="/profile"
          onLogout={handleLogout}
          tip={tip}
        />
      }
    >
      {sections.map((section) => (
        <div key={section.title}>
          <SidebarSectionTitle title={section.title} collapsed={collapsed} />
          <div className="space-y-0.5">{section.items.map(link)}</div>
        </div>
      ))}

      {/* Social: Tráfego Pago (grupo recolhível) + Instagram */}
      {(trafficNav.length > 0 || instagramNav.length > 0) && <SidebarSectionTitle title="Social" collapsed={collapsed} />}
      {trafficNav.length > 0 && (
        <div>
          {collapsed ? (
            <div className="space-y-0.5">{trafficNav.map(link)}</div>
          ) : (
            <div className={cn("overflow-hidden rounded-2xl border transition-colors duration-300", trafficOpen || trafficActive ? "border-white/20 bg-white/10" : "border-white/10 bg-white/5 hover:border-white/20")}>
              <button
                type="button"
                onClick={() => setTrafficOpenManual(!trafficOpen)}
                aria-expanded={trafficOpen}
                aria-controls="sb-traffic-group"
                className="group flex w-full cursor-pointer items-center gap-3 px-2.5 py-2.5 text-left"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-100 transition-transform duration-200 group-hover:scale-110">
                  <TrendingUp className="h-[17px] w-[17px]" strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block whitespace-nowrap text-sm font-bold text-white">Tráfego Pago</span>
                  <span className="block whitespace-nowrap text-[11px] font-semibold text-blue-200/70">Meta Ads · Leads</span>
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-blue-200/80 transition-transform duration-300", trafficOpen && "rotate-180")} />
              </button>
              <div id="sb-traffic-group" className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]", trafficOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                <div className="min-h-0 overflow-hidden">
                  <div className="relative ml-[22px] space-y-0.5 border-l border-white/15 py-1 pl-2.5 pr-2">
                    {trafficNav.map((item) => (
                      <SidebarLink key={item.href} item={item} active={isItemActive(pathname, item)} collapsed={false} onNavigate={onNavigate} tip={tip} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {instagramNav.length > 0 && <div className="space-y-0.5">{instagramNav.map(link)}</div>}

      {areasNav.length > 0 && (
        <div>
          <SidebarSectionTitle title="Áreas" collapsed={collapsed} />
          <div className="space-y-0.5">{areasNav.map(link)}</div>
        </div>
      )}

      {toolsNav.length > 0 && (
        <div>
          <SidebarSectionTitle title="Ferramentas" collapsed={collapsed} />
          <div className="space-y-0.5">{toolsNav.map(link)}</div>
        </div>
      )}
    </SidebarFrame>
  );
}
