"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { pathAllowed } from "@/lib/access";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { unreadIdeasCount } from "@/lib/services/contentIdeas";
import { NAV_SECTIONS } from "@/lib/navigation";
import {
  SIDEBAR_WIDTH, SidebarFrame, SidebarHelpinho, SidebarLink, SidebarSectionTitle, SidebarUser, isItemActive, useSidebarTip,
  type SidebarItem,
} from "./SidebarParts";

export { SIDEBAR_WIDTH };

const ROLE_LABEL: Record<string, string> = { master: "Master", gestor: "Gestor", membro: "Membro", expansao: "Expansão" };

// Seções que a pessoa recolheu (lembradas entre visitas). A seção da página aberta fica sempre aberta.
const CLOSED_KEY = "hm-sidebar-closed-sections";

function useClosedSections() {
  const [closed, setClosed] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CLOSED_KEY);
      if (raw) setClosed(JSON.parse(raw));
    } catch {
      // sem localStorage: tudo aberto
    }
  }, []);
  const toggle = (id: string) =>
    setClosed((current) => {
      const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
      try {
        window.localStorage.setItem(CLOSED_KEY, JSON.stringify(next));
      } catch {
        // segue sem lembrar
      }
      return next;
    });
  return { closed, toggle };
}

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
  const { closed, toggle } = useClosedSections();

  // Pautas novas do Radar de Pauta (n8n) ainda não vistas → bolinha na aba.
  const [ideasBadge, setIdeasBadge] = useState(0);
  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    const load = () => unreadIdeasCount(supabase, profile.id).then(setIdeasBadge).catch(() => {});
    load();
    const interval = setInterval(load, 60000);
    window.addEventListener("content-ideas-seen", load);
    return () => {
      clearInterval(interval);
      window.removeEventListener("content-ideas-seen", load);
    };
  }, [profile]);

  // Abas liberadas para este usuário (profiles.allowed_tabs); null = tudo do papel.
  const sections = NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items
      .filter((i) => pathAllowed(profile, i.href))
      .map((i): SidebarItem => (i.href === "/pautas" ? { ...i, badge: ideasBadge } : i)),
  })).filter((s) => s.items.length > 0);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  let idx = 0;

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
      {sections.map((section) => {
        const hasActive = section.items.some((i) => isItemActive(pathname, i));
        const open = collapsed || hasActive || !closed.includes(section.id);
        return (
          <div key={section.id}>
            <SidebarSectionTitle
              title={section.title}
              collapsed={collapsed}
              open={open}
              count={section.items.length}
              onToggle={hasActive ? undefined : () => toggle(section.id)}
            />
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
                open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
            >
              {/* sem overflow-hidden quando aberto: as curvas da aba ativa passam da borda do item */}
              <div className={cn("min-h-0 space-y-0.5", !open && "overflow-hidden")}>
                {section.items.map((item) => (
                  <SidebarLink
                    key={item.href}
                    item={item}
                    active={isItemActive(pathname, item)}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                    tip={tip}
                    index={idx++}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </SidebarFrame>
  );
}
