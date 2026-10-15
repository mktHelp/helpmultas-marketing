"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, Plus, Search, X } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationDropdown } from "./NotificationDropdown";
import { Button } from "@/components/ui/Button";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { locateNav } from "@/lib/navigation";

// Rotas fora do menu que ainda merecem um "onde estou".
const EXTRA_CRUMBS: [string, string, string][] = [
  ["/assistente", "Assistente", "Helpinho"],
  ["/profile", "Conta", "Meu perfil"],
];

function useCrumbs(pathname: string): { section: string; page: string; href?: string; detail?: boolean } | null {
  const hit = locateNav(pathname);
  if (hit) return { section: hit.section.title, page: hit.item.label, href: hit.item.href, detail: pathname !== hit.item.href && !hit.item.exact };
  const extra = EXTRA_CRUMBS.find(([p]) => pathname === p || pathname.startsWith(p + "/"));
  return extra ? { section: extra[1], page: extra[2] } : null;
}

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const [createOpen, setCreateOpen] = useState(false);
  // No celular a busca fica recolhida atrás de um ícone (a barra larga só cabe a partir de md).
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  const crumbs = useCrumbs(pathname);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200/80 px-4 lg:px-7">
        <button onClick={onMenuClick} aria-label="Abrir menu" className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 lg:hidden">
          <Menu className="h-5 w-5" />
        </button>

        {/* Seção › Página (› Detalhe) */}
        {crumbs && (
          <nav aria-label="Você está em" className="flex min-w-0 items-center gap-1.5 text-[13px]">
            <span className="hidden whitespace-nowrap font-semibold text-gray-500 sm:inline">{crumbs.section}</span>
            <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-gray-300 sm:block" />
            {crumbs.detail && crumbs.href ? (
              <>
                <Link href={crumbs.href} className="truncate font-semibold text-gray-500 hover:text-blue-900">{crumbs.page}</Link>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                <span className="truncate font-bold text-blue-900">Detalhes</span>
              </>
            ) : (
              <span className="truncate font-bold text-blue-900">{crumbs.page}</span>
            )}
          </nav>
        )}

        <div className="ml-auto hidden w-full max-w-sm md:block">
          <GlobalSearch />
        </div>
        <div className="flex shrink-0 items-center gap-1.5 max-md:ml-auto">
          <button
            onClick={() => setSearchOpen((v) => !v)}
            aria-label={searchOpen ? "Fechar busca" : "Buscar"}
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 md:hidden"
          >
            {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>
          <NotificationDropdown />
          <Button size="sm" variant="dark" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova tarefa</span>
          </Button>
        </div>
      </header>
      {searchOpen && (
        <div className="border-b border-gray-200 px-4 py-2 md:hidden">
          <GlobalSearch autoFocus onNavigate={() => setSearchOpen(false)} />
        </div>
      )}
      <CreateTaskModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => window.location.reload()} />
    </>
  );
}
