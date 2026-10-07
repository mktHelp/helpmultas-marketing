"use client";

// Peças da sidebar compartilhadas pelo Hub (Marketing/Tarefas) e pela Expansão, para as
// duas terem exatamente a mesma estrutura, cores e comportamento:
// cabeçalho com marca + recolher, Helpinho em destaque, navegação por seções e rodapé do usuário.

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bot, LogOut, PanelLeftClose, PanelLeftOpen, Sparkles, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/UserAvatar";

export const SIDEBAR_WIDTH = { expanded: 256, collapsed: 76 };

export interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** só marca como ativo quando o caminho é exatamente este */
  exact?: boolean;
}

export function isItemActive(pathname: string, item: Pick<SidebarItem, "href" | "exact">) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

/* ---------------- tooltip do modo recolhido ---------------- */

export interface TipHandlers {
  show: (label: string, el: HTMLElement) => void;
  hide: () => void;
}

export function useSidebarTip(collapsed: boolean) {
  const [state, setState] = useState<{ label: string; top: number } | null>(null);
  useEffect(() => {
    if (!collapsed) setState(null);
  }, [collapsed]);
  const tip: TipHandlers = {
    show: (label, el) => {
      const rect = el.getBoundingClientRect();
      setState({ label, top: rect.top + rect.height / 2 });
    },
    hide: () => setState(null),
  };
  const node =
    collapsed && state ? (
      <div className="pointer-events-none fixed z-[60] -translate-y-1/2" style={{ top: state.top, left: SIDEBAR_WIDTH.collapsed + 10 }}>
        <div role="tooltip" className="sb-item-in whitespace-nowrap rounded-lg bg-blue-900 px-2.5 py-1.5 text-xs font-bold text-white shadow-lg ring-1 ring-white/10">
          {state.label}
        </div>
      </div>
    ) : null;
  return { tip, tipNode: node };
}

/* ---------------- itens ---------------- */

export function SidebarLink({
  item,
  active,
  collapsed,
  onNavigate,
  tip,
  index = 0,
}: {
  item: SidebarItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  tip: TipHandlers;
  index?: number;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      scroll={false}
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
        active ? "bg-yellow-500 text-blue-900 shadow-md shadow-yellow-500/20" : "text-blue-100 hover:bg-white/10 hover:text-white",
        !active && !collapsed && "hover:translate-x-0.5"
      )}
    >
      {active && <span className="sb-bar-in absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-yellow-400" aria-hidden />}
      <span
        className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110", !active && "text-blue-100 group-hover:text-white")}
        style={{ backgroundColor: active ? "rgba(36,55,70,0.14)" : "rgba(255,255,255,0.07)" }}
      >
        <Icon className="h-[17px] w-[17px]" strokeWidth={2.2} />
      </span>
      {!collapsed && <span className="truncate whitespace-nowrap">{item.label}</span>}
    </Link>
  );
}

export function SidebarSectionTitle({ title, collapsed }: { title: string; collapsed: boolean }) {
  if (collapsed) return <div className="mx-auto my-2 h-px w-8 rounded-full bg-white/15" aria-hidden />;
  return (
    <div className="flex items-center gap-2 px-2.5 pb-1 pt-3">
      <p className="whitespace-nowrap text-[10.5px] font-bold uppercase tracking-[0.12em] text-blue-200/70">{title}</p>
      <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" aria-hidden />
    </div>
  );
}

/** Helpinho em destaque, no topo da navegação das duas sidebars. */
export function SidebarHelpinho({ href, active, collapsed, onNavigate, tip }: { href: string; active: boolean; collapsed: boolean; onNavigate?: () => void; tip: TipHandlers }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label={collapsed ? "Helpinho" : undefined}
      aria-current={active ? "page" : undefined}
      onMouseEnter={(e) => collapsed && tip.show("Helpinho", e.currentTarget)}
      onMouseLeave={tip.hide}
      onFocus={(e) => collapsed && tip.show("Helpinho", e.currentTarget)}
      onBlur={tip.hide}
      className={cn(
        "sb-glow sb-sweep group relative flex items-center overflow-hidden rounded-xl bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-400 font-bold text-blue-900 transition-transform duration-200 hover:scale-[1.03]",
        collapsed ? "mx-auto h-11 w-11 justify-center" : "gap-3 px-2.5 py-2.5 text-sm",
        active && "ring-2 ring-white/70"
      )}
    >
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-900 shadow-inner">
        <Bot className="sb-bob h-[18px] w-[18px] text-yellow-400" strokeWidth={2.2} />
      </span>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block whitespace-nowrap">Helpinho</span>
            <span className="block whitespace-nowrap text-[11px] font-semibold text-blue-900/65">Assistente de marketing</span>
          </span>
          <Sparkles className="sb-twinkle h-4 w-4 shrink-0 text-blue-900/75" />
        </>
      )}
    </Link>
  );
}

/** Rodapé: avatar, nome, papel e sair. `extra` entra acima (ex.: "Voltar ao Hub"). */
export function SidebarUser({
  collapsed,
  name,
  avatarUrl,
  subtitle,
  profileHref,
  onLogout,
  tip,
  extra,
}: {
  collapsed: boolean;
  name?: string | null;
  avatarUrl?: string | null;
  subtitle?: string;
  profileHref?: string;
  onLogout: () => void;
  tip: TipHandlers;
  extra?: React.ReactNode;
}) {
  const avatar = <UserAvatar name={name || "?"} avatarUrl={avatarUrl} />;
  const avatarNode = profileHref ? (
    <Link href={profileHref} aria-label="Meu perfil" onMouseEnter={(e) => collapsed && tip.show(name || "Meu perfil", e.currentTarget)} onMouseLeave={tip.hide} className="rounded-full ring-2 ring-transparent transition-all hover:ring-yellow-500/70">
      {avatar}
    </Link>
  ) : (
    avatar
  );
  return (
    <div className={cn("relative shrink-0 border-t border-white/10", collapsed ? "px-2 py-3" : "p-4")}>
      {extra && <div className={cn("mb-3 space-y-0.5", collapsed && "flex flex-col items-center")}>{extra}</div>}
      {collapsed ? (
        <div className="flex flex-col items-center gap-2">
          {avatarNode}
          <button type="button" onClick={onLogout} aria-label="Sair" onMouseEnter={(e) => tip.show("Sair", e.currentTarget)} onMouseLeave={tip.hide} className="rounded-full p-2 text-blue-200 transition-colors hover:bg-white/10 hover:text-white">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {avatarNode}
          <div className="min-w-0 flex-1">
            {profileHref ? (
              <Link href={profileHref} className="block truncate text-sm font-semibold text-white hover:underline">{name || "Carregando..."}</Link>
            ) : (
              <p className="truncate text-sm font-semibold text-white">{name || "Carregando..."}</p>
            )}
            {subtitle && <p className="text-xs text-blue-200">{subtitle}</p>}
          </div>
          <button type="button" onClick={onLogout} title="Sair" aria-label="Sair" className="rounded-full p-2 text-blue-200 transition-colors hover:bg-white/10 hover:text-white">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- estrutura ---------------- */

export function SidebarFrame({
  collapsed,
  animate = true,
  onToggle,
  onClose,
  helpinho,
  footer,
  tipNode,
  onNavScroll,
  children,
}: {
  collapsed: boolean;
  animate?: boolean;
  /** recolher/expandir (só no desktop) */
  onToggle?: () => void;
  /** fecha a gaveta no celular */
  onClose?: () => void;
  helpinho: React.ReactNode;
  footer: React.ReactNode;
  tipNode?: React.ReactNode;
  onNavScroll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "sb-nav relative flex h-full shrink-0 flex-col overflow-hidden bg-gradient-to-b from-blue-900 via-blue-900 to-[#1b2b38]",
        animate && "transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      )}
      style={{ width: collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-yellow-500/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-20 -right-16 h-52 w-52 rounded-full bg-sky-500/10 blur-3xl" aria-hidden />

      {/* marca + recolher */}
      <div className={cn("relative flex shrink-0", collapsed ? "flex-col items-center gap-3 px-2 py-5" : "items-start justify-between px-4 py-5")}>
        {collapsed ? (
          <Image src="/logos/mark-white.png" alt="Help Multas" width={32} height={32} priority className="h-8 w-8 object-contain" />
        ) : (
          <Image src="/logos/wordmark-white.png" alt="Help Multas" width={112} height={28} priority />
        )}
        <div className="flex items-center gap-1">
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              title={collapsed ? "Expandir menu (Ctrl+B)" : "Recolher menu (Ctrl+B)"}
              className="hidden rounded-lg p-2 text-blue-200 transition-colors hover:bg-white/10 hover:text-white lg:block"
            >
              {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Fechar menu" className="rounded-full p-1 text-white/70 hover:bg-white/10 lg:hidden">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className={cn("relative shrink-0 pb-2", collapsed ? "px-2" : "px-3")}>{helpinho}</div>

      <nav aria-label="Navegação principal" className={cn("sb-scroll relative min-h-0 flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden pb-3", collapsed ? "px-2" : "px-3")} onScroll={onNavScroll}>
        {children}
      </nav>

      {footer}
      {tipNode}
    </div>
  );
}
