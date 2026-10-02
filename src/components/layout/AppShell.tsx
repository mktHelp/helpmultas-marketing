"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { LiveCursors } from "@/components/shared/LiveCursors";

const STORAGE_KEY = "hm-sidebar-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  // A transição de largura só liga depois do primeiro paint, pra o menu não
  // "animar" de aberto para recolhido ao carregar a página com a preferência salva.
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
    } catch {
      // localStorage indisponível (modo privado etc.): segue com o padrão
    }
    const id = window.requestAnimationFrame(() => setAnimate(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignora
      }
      return next;
    });
  }, []);

  // Atalho Ctrl/Cmd + B (não dispara enquanto a pessoa digita em campos/editores).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "b" || e.shiftKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      e.preventDefault();
      toggleCollapsed();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleCollapsed]);

  // Esc fecha a gaveta do celular.
  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <div
      className="flex h-screen overflow-hidden bg-gray-100/50"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <LiveCursors />
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} animate={animate} />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-blue-900/40 backdrop-blur-[1px]"
            style={{ animation: "overlay-fade-in 200ms ease-out both" }}
            onClick={() => setMobileOpen(false)}
          />
          <div className="sb-drawer-in absolute inset-y-0 left-0 shadow-[var(--shadow-lg)]">
            <Sidebar onNavigate={() => setMobileOpen(false)} animate={false} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} sidebarCollapsed={collapsed} onToggleSidebar={toggleCollapsed} />
        <main
          className="flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-8"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
