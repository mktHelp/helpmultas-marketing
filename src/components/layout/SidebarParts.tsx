"use client";

// Peças da sidebar compartilhadas pelo Hub (Marketing/Tarefas) e pela Expansão, para as
// duas terem exatamente a mesma estrutura, cores e comportamento:
// cabeçalho com marca + recolher, Helpinho em destaque, navegação por seções e rodapé do usuário.
// A aba ativa usa bordas invertidas: ganha a cor da folha de trabalho e se funde a ela.

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bot, ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen, Pin, PinOff, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavActive } from "@/lib/navigation";
import { UserAvatar } from "@/components/shared/UserAvatar";

export const SIDEBAR_WIDTH = { expanded: 248, collapsed: 72 };

export interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** só marca como ativo quando o caminho é exatamente este */
  exact?: boolean;
  /** aviso de "novidade" (ex.: pautas novas não vistas) */
  badge?: number;
}

export const isItemActive = isNavActive;

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
      <div className="pointer-events-none fixed z-[60] -translate-y-1/2" style={{ top: state.top, left: SIDEBAR_WIDTH.collapsed + 12 }}>
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
  pinned,
  onTogglePin,
}: {
  item: SidebarItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  tip: TipHandlers;
  index?: number;
  /** quando informado (e o menu está expandido), mostra o botão de fixar ao passar o mouse */
  pinned?: boolean;
  onTogglePin?: () => void;
}) {
  const Icon = item.icon;
  const link = (
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
      style={{ animationDelay: `${Math.min(index, 14) * 18}ms` }}
      className={cn(
        "sb-item-in group relative flex items-center rounded-[10px] text-[13px] font-semibold transition-colors duration-150",
        collapsed ? "h-10 justify-center" : "h-9 gap-2.5 pl-2.5",
        active
          ? cn("sb-tab-active rounded-r-none text-blue-900", collapsed ? "mr-0 pr-[10px]" : "mr-0 pr-5")
          : cn("text-blue-100/75 hover:bg-white/[0.07] hover:text-white", collapsed ? "mr-[10px]" : "mr-3 pr-2.5")
      )}
    >
      <Icon
        className={cn("h-[17px] w-[17px] shrink-0 transition-colors", active ? "text-blue-900" : "text-blue-200/70 group-hover:text-yellow-500")}
        strokeWidth={active ? 2.3 : 2}
      />
      {!collapsed && <span className="truncate whitespace-nowrap">{item.label}</span>}
      {active && !collapsed && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" aria-hidden />}
      {!!item.badge && (
        <span
          aria-label={`${item.badge} novidade(s)`}
          className={cn(
            "relative flex items-center justify-center rounded-full bg-red-500 font-bold text-white",
            collapsed ? "absolute right-1.5 top-1.5 h-2.5 w-2.5" : cn("h-[18px] min-w-[18px] px-1 text-[10px]", active ? "ml-1.5" : "ml-auto")
          )}
        >
          {!collapsed && (item.badge > 9 ? "9+" : item.badge)}
        </span>
      )}
    </Link>
  );
  if (!onTogglePin || collapsed) return link;
  return (
    <div className="group/pin relative">
      {link}
      <button
        type="button"
        onClick={onTogglePin}
        aria-label={pinned ? `Desafixar ${item.label}` : `Fixar ${item.label}`}
        title={pinned ? "Desafixar" : "Fixar na sidebar"}
        className={cn(
          "absolute right-4 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md transition-opacity focus-visible:opacity-100 group-hover/pin:opacity-100",
          pinned ? "opacity-100" : "opacity-0",
          active ? "text-blue-900/60 hover:bg-blue-900/10 hover:text-blue-900" : "text-blue-200/70 hover:bg-white/10 hover:text-yellow-500"
        )}
      >
        {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

/**
 * Título de seção. Com `onToggle`, vira um botão que recolhe/expande a seção.
 * No modo recolhido, vira apenas um separador.
 */
export function SidebarSectionTitle({
  title,
  collapsed,
  open = true,
  onToggle,
  count,
}: {
  title: string;
  collapsed: boolean;
  open?: boolean;
  onToggle?: () => void;
  /** quantidade de itens (aparece quando a seção está fechada) */
  count?: number;
}) {
  if (collapsed) return <div className="my-2 mr-[10px] h-px rounded-full bg-white/10" aria-hidden />;
  const content = (
    <>
      <span className="whitespace-nowrap text-[10.5px] font-bold uppercase tracking-[0.14em] text-blue-200/55 transition-colors group-hover:text-blue-100">{title}</span>
      {!open && count ? <span className="rounded-full bg-white/10 px-1.5 text-[10px] font-bold text-blue-100/70">{count}</span> : null}
      {onToggle && <ChevronDown className={cn("ml-auto h-3.5 w-3.5 text-blue-200/50 transition-transform duration-200 group-hover:text-blue-100", !open && "-rotate-90")} />}
    </>
  );
  if (!onToggle) return <div className="group mr-3 flex items-center gap-2 px-2.5 pb-1 pt-4">{content}</div>;
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className="group mr-3 flex w-[calc(100%-12px)] items-center gap-2 rounded-md px-2.5 pb-1 pt-4 text-left">
      {content}
    </button>
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
        "group relative flex items-center rounded-xl border font-semibold transition-colors duration-200",
        collapsed ? "mx-auto h-10 w-10 justify-center" : "gap-2.5 px-2 py-2 text-[13px]",
        active ? "border-yellow-500/60 bg-yellow-500/15 text-white" : "border-white/10 bg-white/[0.04] text-blue-50 hover:border-yellow-500/40 hover:bg-white/[0.08]"
      )}
    >
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-yellow-500 text-blue-900">
        <Bot className="h-4 w-4" strokeWidth={2.3} />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[color:var(--surface-frame)]" aria-hidden />
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block whitespace-nowrap">Helpinho</span>
          <span className="block whitespace-nowrap text-[11px] font-medium text-blue-200/60">Assistente de marketing</span>
        </span>
      )}
      {!collapsed && <kbd className="rounded border border-white/10 px-1.5 py-0.5 font-sans text-[10px] font-bold text-blue-200/60">IA</kbd>}
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
  const avatar = <UserAvatar name={name || "?"} avatarUrl={avatarUrl} size="sm" />;
  const avatarNode = profileHref ? (
    <Link href={profileHref} aria-label="Meu perfil" onMouseEnter={(e) => collapsed && tip.show(name || "Meu perfil", e.currentTarget)} onMouseLeave={tip.hide} className="rounded-full ring-2 ring-transparent transition-all hover:ring-yellow-500/70">
      {avatar}
    </Link>
  ) : (
    avatar
  );
  return (
    <div className={cn("relative shrink-0 border-t border-white/[0.08]", collapsed ? "px-2 py-3" : "px-3 py-3")}>
      {extra && <div className={cn("mb-2 space-y-0.5", collapsed && "flex flex-col items-center")}>{extra}</div>}
      {collapsed ? (
        <div className="flex flex-col items-center gap-2">
          {avatarNode}
          <button type="button" onClick={onLogout} aria-label="Sair" onMouseEnter={(e) => tip.show("Sair", e.currentTarget)} onMouseLeave={tip.hide} className="rounded-lg p-2 text-blue-200/70 transition-colors hover:bg-white/10 hover:text-white">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-xl px-1.5 py-1">
          {avatarNode}
          <div className="min-w-0 flex-1 leading-tight">
            {profileHref ? (
              <Link href={profileHref} className="block truncate text-[13px] font-semibold text-white hover:underline">{name || "Carregando..."}</Link>
            ) : (
              <p className="truncate text-[13px] font-semibold text-white">{name || "Carregando..."}</p>
            )}
            {subtitle && <p className="text-[11px] text-blue-200/60">{subtitle}</p>}
          </div>
          <button type="button" onClick={onLogout} title="Sair" aria-label="Sair" className="rounded-lg p-2 text-blue-200/70 transition-colors hover:bg-white/10 hover:text-white">
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
        "sb-nav relative flex h-full shrink-0 flex-col overflow-hidden bg-[color:var(--surface-frame)]",
        animate && "transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      )}
      style={{ width: collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* marca + recolher */}
      <div className={cn("relative flex h-14 shrink-0 items-center", collapsed ? "justify-center px-2" : "justify-between pl-4 pr-3")}>
        {collapsed ? (
          onToggle ? (
            <button type="button" onClick={onToggle} aria-label="Expandir menu" title="Expandir menu (Ctrl+B)" className="group relative flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/10">
              <Image src="/logos/mark-white.png" alt="Help Multas" width={26} height={26} priority className="h-[26px] w-[26px] object-contain transition-opacity group-hover:opacity-0" />
              <PanelLeftOpen className="absolute h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ) : (
            <Image src="/logos/mark-white.png" alt="Help Multas" width={26} height={26} priority className="h-[26px] w-[26px] object-contain" />
          )
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">
            <Image src="/logos/wordmark-white.png" alt="Help Multas" width={100} height={25} priority style={{ width: 100, height: "auto" }} />
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-500">Hub</span>
          </div>
        )}
        {!collapsed && (
          <div className="flex items-center gap-1">
            {onToggle && (
              <button
                type="button"
                onClick={onToggle}
                aria-label="Recolher menu"
                title="Recolher menu (Ctrl+B)"
                className="hidden rounded-lg p-1.5 text-blue-200/70 transition-colors hover:bg-white/10 hover:text-white lg:block"
              >
                <PanelLeftClose className="h-[18px] w-[18px]" />
              </button>
            )}
            {onClose && (
              <button type="button" onClick={onClose} aria-label="Fechar menu" className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 lg:hidden">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className={cn("relative shrink-0 pb-1", collapsed ? "px-2" : "px-3")}>{helpinho}</div>

      <nav
        aria-label="Navegação principal"
        className={cn("relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", collapsed ? "pl-[10px]" : "pl-3")}
        onScroll={onNavScroll}
      >
        {children}
      </nav>

      {footer}
      {tipNode}
    </div>
  );
}
