"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Sun, ListTodo, ListChecks, Kanban, Calendar,
  FolderKanban, Megaphone, FileText, Users, BarChart3, Settings, Trash2,
  LogOut, X, Cake, AtSign, Image as ImageIcon, Bot, Sparkles, Mic, HandCoins, TrendingUp, Gauge, Contact,
  ChevronDown, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { UserAvatar } from "@/components/shared/UserAvatar";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** cor do ícone (tom claro, para fundo azul escuro) */
  color: string;
  /** só marca como ativo quando o caminho é exatamente este */
  exact?: boolean;
}

const ASSISTENTE_ITEM: NavItem = { href: "/assistente", label: "Assistente", icon: Bot, color: "#fcbf00" };

const SECTIONS: { title: string; dot: string; items: NavItem[] }[] = [
  {
    title: "Trabalho",
    dot: "#7dd3fc",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, color: "#7dd3fc" },
      { href: "/my-day", label: "Meu Dia", icon: Sun, color: "#fcd34d" },
      { href: "/my-tasks", label: "Minhas Tarefas", icon: ListChecks, color: "#6ee7b7" },
      { href: "/tasks", label: "Todas as Tarefas", icon: ListTodo, color: "#a5b4fc" },
      { href: "/board", label: "Quadro", icon: Kanban, color: "#f9a8d4" },
      { href: "/calendar", label: "Calendário", icon: Calendar, color: "#fdba74" },
    ],
  },
  {
    title: "Planejamento",
    dot: "#c4b5fd",
    items: [
      { href: "/projects", label: "Projetos", icon: FolderKanban, color: "#c4b5fd" },
      { href: "/campaigns", label: "Campanhas", icon: Megaphone, color: "#fda4af" },
      { href: "/content", label: "Conteúdos", icon: FileText, color: "#5eead4" },
    ],
  },
  {
    title: "Gestão",
    dot: "#93c5fd",
    items: [
      { href: "/team", label: "Equipe", icon: Users, color: "#93c5fd" },
      { href: "/birthdays", label: "Aniversários", icon: Cake, color: "#f0abfc" },
      { href: "/reports", label: "Relatórios", icon: BarChart3, color: "#bef264" },
    ],
  },
];

// Criativos + Gerenciador de Anúncios da Meta (somente leitura), agrupados
// à parte porque formam a mesma área de trabalho (Tráfego Pago).
const TRAFFIC_NAV: NavItem[] = [
  { href: "/trafego-pago/dashboard", label: "Dashboard", icon: Gauge, color: "#7dd3fc", exact: true },
  { href: "/creatives", label: "Criativos", icon: ImageIcon, color: "#a5b4fc" },
  { href: "/trafego-pago", label: "Tráfego Pago", icon: TrendingUp, color: "#67e8f9", exact: true },
  { href: "/trafego-pago/leads", label: "Leads", icon: Contact, color: "#c4b5fd", exact: true },
];

// Insights dos perfis do Instagram (dashboard + relatório em PDF).
const INSTAGRAM_ITEM: NavItem = { href: "/instagram", label: "Instagram", icon: AtSign, color: "#f9a8d4" };

// Dashboard independente (fora deste shell), compartilhado com o time de expansão.
const EXPANSION_ITEM: NavItem = { href: "/expansao", label: "Expansão", icon: HandCoins, color: "#6ee7b7" };

const TOOLS_NAV: NavItem[] = [
  { href: "/teleprompter", label: "Teleprompter", icon: Mic, color: "#67e8f9" },
  { href: "/trash", label: "Lixeira", icon: Trash2, color: "#fca5a5" },
  { href: "/settings", label: "Configurações", icon: Settings, color: "#cbd5e1" },
];

const ROLE_LABEL: Record<string, string> = { master: "Master", gestor: "Gestor", membro: "Membro", expansao: "Expansão" };

export const SIDEBAR_WIDTH = { expanded: 256, collapsed: 76 };

type Variant = "default" | "traffic";

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

interface TipHandlers {
  show: (label: string, el: HTMLElement) => void;
  hide: () => void;
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
  tip,
  index,
  variant = "default",
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  tip: TipHandlers;
  index: number;
  variant?: Variant;
}) {
  const Icon = item.icon;
  const activeClasses =
    variant === "traffic"
      ? "bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-md shadow-sky-500/25"
      : "bg-yellow-500 text-blue-900 shadow-md shadow-yellow-500/20";

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-label={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      onMouseEnter={(e) => collapsed && tip.show(item.label, e.currentTarget)}
      onMouseLeave={tip.hide}
      onFocus={(e) => collapsed && tip.show(item.label, e.currentTarget)}
      onBlur={tip.hide}
      style={{ animationDelay: `${Math.min(index, 10) * 28}ms` }}
      className={cn(
        "sb-item-in group relative flex items-center rounded-xl text-sm font-semibold transition-all duration-200",
        collapsed ? "mx-auto h-11 w-11 justify-center" : "gap-3 px-2.5 py-2",
        active ? activeClasses : "text-blue-100 hover:bg-white/10 hover:text-white",
        !active && !collapsed && "hover:translate-x-0.5"
      )}
    >
      {active && <span className="sb-bar-in absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-yellow-400" aria-hidden />}
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110",
          active && "bg-white/20"
        )}
        style={active ? (variant === "traffic" ? undefined : { backgroundColor: "rgba(36,55,70,0.14)" }) : { backgroundColor: `${item.color}22`, color: item.color }}
      >
        <Icon className="h-[17px] w-[17px]" strokeWidth={2.2} />
      </span>
      {!collapsed && <span className="truncate whitespace-nowrap">{item.label}</span>}
    </Link>
  );
}

function SectionTitle({ title, dot, collapsed }: { title: string; dot: string; collapsed: boolean }) {
  if (collapsed) {
    return <div className="mx-auto my-2 h-px w-8 rounded-full" style={{ backgroundColor: `${dot}55` }} aria-hidden />;
  }
  return (
    <div className="flex items-center gap-2 px-2.5 pb-1 pt-3">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} aria-hidden />
      <p className="whitespace-nowrap text-[10.5px] font-bold uppercase tracking-[0.12em] text-blue-200/70">{title}</p>
      <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" aria-hidden />
    </div>
  );
}

/** Cartão de destaque (link único) com gradiente próprio. */
function FeatureCard({
  item,
  active,
  collapsed,
  onNavigate,
  tip,
  subtitle,
  gradient,
  activeGradient,
  chip,
  glow,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  tip: TipHandlers;
  subtitle: string;
  gradient: string;
  activeGradient: string;
  chip: string;
  glow: string;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-label={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      onMouseEnter={(e) => collapsed && tip.show(item.label, e.currentTarget)}
      onMouseLeave={tip.hide}
      onFocus={(e) => collapsed && tip.show(item.label, e.currentTarget)}
      onBlur={tip.hide}
      className={cn(
        "group relative flex items-center overflow-hidden rounded-xl border transition-all duration-200 hover:-translate-y-0.5",
        collapsed ? "mx-auto h-11 w-11 justify-center" : "gap-3 px-2.5 py-2.5",
        active ? `${activeGradient} border-white/40 text-white shadow-lg ${glow}` : `${gradient} border-white/10 text-white hover:border-white/30`
      )}
    >
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-inner transition-transform duration-200 group-hover:rotate-6 group-hover:scale-110", chip)}>
        <Icon className="h-[17px] w-[17px] text-white" strokeWidth={2.3} />
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate whitespace-nowrap text-sm font-bold">{item.label}</span>
          <span className="block truncate whitespace-nowrap text-[11px] font-semibold text-white/65">{subtitle}</span>
        </span>
      )}
    </Link>
  );
}

export function Sidebar({
  onNavigate,
  collapsed = false,
  animate = true,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  /** liga a transição de largura (desligada no primeiro paint pra não "piscar") */
  animate?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuth();

  const trafficActive = TRAFFIC_NAV.some((i) => isActive(pathname, i));
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

  const [tipState, setTipState] = useState<{ label: string; top: number } | null>(null);
  const tip: TipHandlers = {
    show: (label, el) => {
      const rect = el.getBoundingClientRect();
      setTipState({ label, top: rect.top + rect.height / 2 });
    },
    hide: () => setTipState(null),
  };

  useEffect(() => {
    if (!collapsed) setTipState(null);
  }, [collapsed]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  let idx = 0;
  const next = () => idx++;

  return (
    <div
      className={cn(
        "sb-nav relative flex h-full shrink-0 flex-col overflow-hidden bg-gradient-to-b from-blue-900 via-blue-900 to-[#1b2b38]",
        animate && "transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      )}
      style={{
        width: collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded,
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* brilho decorativo */}
      <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-yellow-500/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-20 -right-16 h-52 w-52 rounded-full bg-sky-500/10 blur-3xl" aria-hidden />

      {/* topo */}
      <div className={cn("relative flex shrink-0 items-center", collapsed ? "justify-center px-2 py-5" : "justify-between px-4 py-5")}>
        {collapsed ? (
          <Image src="/logos/mark-white.png" alt="Help Multas" width={32} height={32} priority className="h-8 w-8 object-contain" />
        ) : (
          <Image src="/logos/wordmark-white.png" alt="Help Multas" width={112} height={28} priority />
        )}

        <div className="flex items-center gap-1">
          {onNavigate && (
            <button type="button" onClick={onNavigate} aria-label="Fechar menu" className="rounded-full p-1 text-white/70 hover:bg-white/10 lg:hidden">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Assistente em destaque */}
      <div className={cn("relative shrink-0 pb-2", collapsed ? "px-2" : "px-3")}>
        <Link
          href={ASSISTENTE_ITEM.href}
          onClick={onNavigate}
          aria-label={collapsed ? ASSISTENTE_ITEM.label : undefined}
          onMouseEnter={(e) => collapsed && tip.show(ASSISTENTE_ITEM.label, e.currentTarget)}
          onMouseLeave={tip.hide}
          onFocus={(e) => collapsed && tip.show(ASSISTENTE_ITEM.label, e.currentTarget)}
          onBlur={tip.hide}
          className={cn(
            "sb-glow sb-sweep group relative flex items-center overflow-hidden rounded-xl bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-400 font-bold text-blue-900 transition-transform duration-200 hover:scale-[1.03]",
            collapsed ? "mx-auto h-11 w-11 justify-center" : "gap-3 px-2.5 py-2.5 text-sm",
            pathname === ASSISTENTE_ITEM.href || pathname.startsWith(ASSISTENTE_ITEM.href + "/") ? "ring-2 ring-white/70" : ""
          )}
        >
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-900 shadow-inner">
            <Bot className="sb-bob h-[18px] w-[18px] text-yellow-400" strokeWidth={2.2} />
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block whitespace-nowrap">Assistente</span>
                <span className="block whitespace-nowrap text-[11px] font-semibold text-blue-900/65">IA do Marketing Hub</span>
              </span>
              <Sparkles className="sb-twinkle h-4 w-4 shrink-0 text-blue-900/75" />
            </>
          )}
        </Link>
      </div>

      {/* navegação */}
      <nav
        className={cn("sb-scroll relative min-h-0 flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden pb-3", collapsed ? "px-2" : "px-3")}
        onScroll={tip.hide}
      >
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <SectionTitle title={section.title} dot={section.dot} collapsed={collapsed} />
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item)}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                  tip={tip}
                  index={next()}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Tráfego Pago: grupo em destaque (sanfona) */}
        <div className="pt-3">
          {collapsed ? (
            <>
              <div className="mx-auto mb-2 h-0.5 w-8 rounded-full bg-gradient-to-r from-sky-400 to-indigo-400" aria-hidden />
              <div className="space-y-0.5">
                {TRAFFIC_NAV.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={isActive(pathname, item)}
                    collapsed
                    onNavigate={onNavigate}
                    tip={tip}
                    index={next()}
                    variant="traffic"
                  />
                ))}
              </div>
            </>
          ) : (
            <div
              className={cn(
                "overflow-hidden rounded-2xl border transition-colors duration-300",
                trafficOpen || trafficActive ? "border-sky-400/30 bg-gradient-to-br from-sky-500/15 to-indigo-500/15" : "border-white/10 bg-white/5 hover:border-sky-400/25"
              )}
            >
              <button
                type="button"
                onClick={() => setTrafficOpenManual(!trafficOpen)}
                aria-expanded={trafficOpen}
                aria-controls="sb-traffic-group"
                className="group flex w-full items-center gap-3 px-2.5 py-2.5 text-left"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 shadow-md shadow-sky-500/30 transition-transform duration-200 group-hover:rotate-6 group-hover:scale-110">
                  <TrendingUp className="h-[17px] w-[17px] text-white" strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block whitespace-nowrap text-sm font-bold text-white">Tráfego Pago</span>
                  <span className="block whitespace-nowrap text-[11px] font-semibold text-sky-200/70">Meta Ads · Leads</span>
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-sky-200/80 transition-transform duration-300", trafficOpen && "rotate-180")} />
              </button>
              <div
                id="sb-traffic-group"
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                  trafficOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="relative ml-[22px] space-y-0.5 border-l border-sky-300/20 py-1 pl-2.5 pr-2">
                    {TRAFFIC_NAV.map((item) => (
                      <NavLink
                        key={item.href}
                        item={item}
                        active={isActive(pathname, item)}
                        collapsed={false}
                        onNavigate={onNavigate}
                        tip={tip}
                        index={0}
                        variant="traffic"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Instagram + Expansão em destaque */}
        <div className={cn("space-y-1.5 pt-3", collapsed && "space-y-0.5")}>
          {collapsed && <div className="mx-auto mb-2 h-0.5 w-8 rounded-full bg-gradient-to-r from-pink-400 to-orange-300" aria-hidden />}
          <FeatureCard
            item={INSTAGRAM_ITEM}
            active={isActive(pathname, INSTAGRAM_ITEM)}
            collapsed={collapsed}
            onNavigate={onNavigate}
            tip={tip}
            subtitle="Insights e relatório"
            gradient="bg-gradient-to-r from-fuchsia-500/25 via-pink-500/20 to-orange-400/25"
            activeGradient="bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-400"
            chip="bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400"
            glow="shadow-pink-500/30"
          />
          <FeatureCard
            item={EXPANSION_ITEM}
            active={isActive(pathname, EXPANSION_ITEM)}
            collapsed={collapsed}
            onNavigate={onNavigate}
            tip={tip}
            subtitle="Painel da expansão"
            gradient="bg-gradient-to-r from-emerald-500/25 to-teal-400/20"
            activeGradient="bg-gradient-to-r from-emerald-500 to-teal-400"
            chip="bg-gradient-to-br from-emerald-400 to-teal-500"
            glow="shadow-emerald-500/30"
          />
        </div>

        {/* ferramentas */}
        <SectionTitle title="Ferramentas" dot="#cbd5e1" collapsed={collapsed} />
        <div className="space-y-0.5">
          {TOOLS_NAV.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item)}
              collapsed={collapsed}
              onNavigate={onNavigate}
              tip={tip}
              index={next()}
            />
          ))}
        </div>
      </nav>

      {/* usuário */}
      <div className={cn("relative shrink-0 border-t border-white/10", collapsed ? "px-2 py-3" : "p-4")}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Link
              href="/profile"
              aria-label="Meu perfil"
              onMouseEnter={(e) => tip.show(profile?.full_name || "Meu perfil", e.currentTarget)}
              onMouseLeave={tip.hide}
              className="rounded-full ring-2 ring-transparent transition-all hover:ring-yellow-500/70"
            >
              <UserAvatar name={profile?.full_name || "?"} avatarUrl={profile?.avatar_url} />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sair"
              onMouseEnter={(e) => tip.show("Sair", e.currentTarget)}
              onMouseLeave={tip.hide}
              className="rounded-full p-2 text-blue-200 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link href="/profile" aria-label="Meu perfil" className="rounded-full ring-2 ring-transparent transition-all hover:ring-yellow-500/70">
              <UserAvatar name={profile?.full_name || "?"} avatarUrl={profile?.avatar_url} />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href="/profile" className="block truncate text-sm font-semibold text-white hover:underline">
                {profile?.full_name || "Carregando..."}
              </Link>
              <p className="text-xs text-blue-200">{profile ? ROLE_LABEL[profile.role] : ""}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sair"
              aria-label="Sair"
              className="rounded-full p-2 text-blue-200 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* tooltip do modo recolhido (fixed: escapa do overflow da sidebar) */}
      {collapsed && tipState && (
        <div className="pointer-events-none fixed z-[60] -translate-y-1/2" style={{ top: tipState.top, left: SIDEBAR_WIDTH.collapsed + 10 }}>
          <div
            role="tooltip"
            className="sb-item-in whitespace-nowrap rounded-lg bg-blue-900 px-2.5 py-1.5 text-xs font-bold text-white shadow-lg ring-1 ring-white/10"
          >
            {tipState.label}
          </div>
        </div>
      )}
    </div>
  );
}
