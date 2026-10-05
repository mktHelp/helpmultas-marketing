"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { ExpansionBottomNav, ExpansionSideNav } from "@/components/expansion/ExpansionNav";
import { cn } from "@/lib/utils";

const COLLAPSED_KEY = "hm-expansion-sidebar-collapsed";

// Desktop: sidebar azul que abre/fecha (lembra a escolha). Celular: faixa fina
// no topo (logo + sair) e barra de abas no rodapé.
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

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      // sem localStorage: começa aberta
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, prev ? "0" : "1");
      } catch {
        // segue sem lembrar
      }
      return !prev;
    });
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login?redirectTo=/expansao");
    router.refresh();
  }

  const logoutButton = (
    <button onClick={handleLogout} title="Sair" className="rounded-full p-2 text-blue-200 hover:bg-white/10 hover:text-white">
      <LogOut className="h-4 w-4" />
    </button>
  );

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop */}
      <aside
        className={cn(
          "relative z-30 hidden shrink-0 flex-col overflow-hidden bg-gradient-to-b from-blue-900 via-blue-800 to-blue-900 py-5 text-white transition-[width] duration-300 md:sticky md:top-0 md:flex md:h-screen",
          collapsed ? "w-[76px] px-3" : "w-64 px-4"
        )}
      >
        <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-yellow-500/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-sky-400/10 blur-3xl" aria-hidden />

        <div className={cn("relative mb-6 flex items-start", collapsed ? "justify-center" : "justify-between gap-2 px-1")}>
          {!collapsed && (
            <div>
              <Image src="/logos/wordmark-white.png" alt="Help Multas" width={120} height={30} />
              <span className="mt-3 inline-block rounded-full bg-yellow-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-900">
                Expansão
              </span>
            </div>
          )}
          <button
            onClick={toggle}
            title={collapsed ? "Abrir menu" : "Fechar menu"}
            aria-label={collapsed ? "Abrir menu" : "Fechar menu"}
            className="rounded-lg p-2 text-blue-200 hover:bg-white/10 hover:text-white"
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <Suspense>
            <ExpansionSideNav collapsed={collapsed} />
          </Suspense>
        </div>

        <div className={cn("relative space-y-2 border-t border-white/10 pt-4", collapsed && "flex flex-col items-center")}>
          {canReturnToHub && (
            <Link
              href="/dashboard"
              title="Voltar ao Hub"
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-blue-100 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              {!collapsed && "Voltar ao Hub"}
            </Link>
          )}
          <div className={cn("flex items-center gap-3", collapsed ? "flex-col" : "px-2")}>
            {userName && (
              <>
                <UserAvatar name={userName} />
                {!collapsed && <span className="min-w-0 flex-1 truncate text-sm font-semibold">{userName}</span>}
              </>
            )}
            {logoutButton}
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Celular */}
        <header
          className="sticky top-0 z-50 bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 shadow-md md:hidden"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Image src="/logos/wordmark-white.png" alt="Help Multas" width={104} height={26} />
            <div className="flex items-center gap-1">
              {canReturnToHub && (
                <Link href="/dashboard" title="Voltar ao Hub" className="rounded-full p-2 text-blue-100 hover:bg-white/10">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              )}
              {userName && <UserAvatar name={userName} />}
              {logoutButton}
            </div>
          </div>
        </header>

        <main className="p-4 pb-24 md:pb-8 lg:p-8">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>

      <Suspense>
        <ExpansionBottomNav />
      </Suspense>
    </div>
  );
}
