"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Kanban } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { TasksWorkspace } from "@/components/tasks/TasksWorkspace";
import { PlanningWorkspace } from "./PlanningWorkspace";
import { cn } from "@/lib/utils";

type Tab = "planejamento" | "producao";
const TABS: { value: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "planejamento", label: "Planejamento", icon: CalendarRange },
  { value: "producao", label: "Produção", icon: Kanban },
];

/**
 * Conteúdos: Planejamento (cronograma e roteiros por perfil: ano, mês, semana e dia) e Produção
 * (as tarefas de conteúdo em Quadro, Lista e Calendário). Um post planejado vira tarefa de produção.
 */
export function ContentHub() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab: Tab = searchParams.get("aba") === "producao" ? "producao" : "planejamento";

  function changeTab(next: Tab) {
    // cada aba tem seus próprios parâmetros (visão, perfil, data): ao trocar, recomeça limpo
    router.replace(next === "planejamento" ? pathname : `${pathname}?aba=${next}`, { scroll: false });
  }

  return (
    <div>
      <PageHeader
        title="Conteúdos"
        description={
          tab === "planejamento"
            ? "Planeje o ano, o mês, a semana e o dia dos dois perfis do Instagram, com roteiros e pendências."
            : "Reels, Stories, Blog, E-mail e demais formatos em produção."
        }
      />

      <div role="tablist" aria-label="Seção de conteúdos" className="mb-4 inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-[var(--shadow-sm)]">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => changeTab(t.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-all active:scale-95",
              tab === t.value ? "bg-yellow-500 text-blue-900 shadow-sm" : "text-gray-600 hover:bg-gray-050"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "planejamento" ? <PlanningWorkspace /> : <TasksWorkspace contentOnly embedded />}
    </div>
  );
}
