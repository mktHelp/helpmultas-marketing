"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Menu } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { ExpansionHelpinho, ExpansionSideNav } from "@/components/expansion/ExpansionNav";
import { SidebarFrame, SidebarLink, SidebarUser, useSidebarTip } from "@/components/layout/SidebarParts";

const COLLAPSED_KEY = "hm-expansion-sidebar-collapsed";

/** A mesma sidebar do Hub (estrutura e visual compartilhados), com a navegação da Expansão. */
function ExpansionSidebar({
  collapsed,
  animate,
  onToggle,
  onNavigate,
  userName,
  canReturnToHub,
  onLogout,
}: {
  collapsed: boolean;
  animate: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  userName: string;
  canReturnToHub: boolean;
  onLogout: () => void;
}) {
  const { tip, tipNode } = useSidebarTip(collapsed);
  return (
    <SidebarFrame
      collapsed={collapsed}
      animate={animate}
      onToggle={onToggle}
      onClose={onNavigate}
      onNavScroll={tip.hide}
      tipNode={tipNode}
      helpinho={<Suspense><ExpansionHelpinho collapsed={collapsed} tip={tip} onNavigate={onNavigate} /></Suspense>}
      footer={
        <SidebarUser
          collapsed={collapsed}
          name={userName}
          subtitle="Expansão"
          onLogout={onLogout}
          tip={tip}
          extra={canReturnToHub ? <SidebarLink item={{ href: "/dashboard", label: "Voltar ao Hub", icon: ArrowLeft }} active={false} collapsed={collapsed} onNavigate={onNavigate} tip={tip} /> : undefined}
        />
      }
    >
      <Suspense>
        <ExpansionSideNav collapsed={collapsed} tip={tip} onNavigate={onNavigate} />
      </Suspense>
    </SidebarFrame>
  );
}

// Mesmo padrão do Hub: no desktop (lg) a sidebar fica fixa e recolhível (lembra a escolha, Ctrl+B);
// no celular ela abre como gaveta a partir de uma barra superior.
export function ExpansionShell({
  userName,
  canReturnToHub,
  children,
}: {
  userName: string;
  canReturnToHub: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // a transição de largura só liga depois do primeiro paint, para não "animar" ao carregar
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      // sem localStorage: começa aberta
    }
    const id = window.requestAnimationFrame(() => setAnimate(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, prev ? "0" : "1");
      } catch {
        // segue sem lembrar
      }
      return !prev;
    });
  }, []);

  // Ctrl/Cmd + B recolhe o menu, como no Hub (não dispara enquanto digita).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "b" || e.shiftKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      e.preventDefault();
      toggle();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  // Esc fecha a gaveta do celular.
  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login?redirectTo=/expansao");
    router.refresh();
  }

  return (
    <div className="min-h-screen lg:flex print:!block print:min-h-0">
      {/* Desktop */}
      <aside className="relative z-30 hidden shrink-0 lg:sticky lg:top-0 lg:block lg:h-screen print:!hidden">
        <ExpansionSidebar collapsed={collapsed} animate={animate} onToggle={toggle} userName={userName} canReturnToHub={canReturnToHub} onLogout={handleLogout} />
      </aside>

      {/* Celular: gaveta com a mesma sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:!hidden">
          <div className="absolute inset-0 bg-blue-900/40 backdrop-blur-[1px]" style={{ animation: "overlay-fade-in 200ms ease-out both" }} onClick={() => setMobileOpen(false)} />
          <div className="sb-drawer-in absolute inset-y-0 left-0 shadow-[var(--shadow-lg)]">
            <ExpansionSidebar collapsed={false} animate={false} onNavigate={() => setMobileOpen(false)} userName={userName} canReturnToHub={canReturnToHub} onLogout={handleLogout} />
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1 print:!block">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:hidden print:!hidden" style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}>
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Abrir menu" className="rounded-lg p-2 text-gray-700 hover:bg-gray-100">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display text-base font-bold text-blue-900">Expansão</span>
          {userName && <span className="ml-auto"><UserAvatar name={userName} /></span>}
        </header>

        <main className="p-4 lg:p-8 print:p-0">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
