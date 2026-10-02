"use client";

import { useState } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen, Plus, Search, X } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationDropdown } from "./NotificationDropdown";
import { Button } from "@/components/ui/Button";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";

export function Topbar({
  onMenuClick,
  sidebarCollapsed = false,
  onToggleSidebar,
}: {
  onMenuClick: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  // No celular a busca fica recolhida atrás de um ícone (a barra larga só cabe a partir de md).
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:px-8">
        <button onClick={onMenuClick} className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 lg:hidden">
          <Menu className="h-5 w-5" />
        </button>
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            title={sidebarCollapsed ? "Expandir menu (Ctrl+B)" : "Recolher menu (Ctrl+B)"}
            className="hidden rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 lg:block"
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        )}
        <div className="hidden flex-1 md:block">
          <GlobalSearch />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setSearchOpen((v) => !v)}
            aria-label={searchOpen ? "Fechar busca" : "Buscar"}
            className="rounded-full p-2 text-gray-700 hover:bg-gray-100 md:hidden"
          >
            {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Tarefa</span>
          </Button>
          <NotificationDropdown />
        </div>
      </header>
      {searchOpen && (
        <div className="border-b border-gray-200 bg-white px-4 py-2 md:hidden">
          <GlobalSearch autoFocus onNavigate={() => setSearchOpen(false)} />
        </div>
      )}
      <CreateTaskModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => window.location.reload()} />
    </>
  );
}
