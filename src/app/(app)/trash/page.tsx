"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Archive, Clock, FolderOpen, Layers, RotateCcw, Search, ShieldAlert, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PriorityBadge, StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { archiveTask, listTasks, permanentlyDeleteTask, restoreTask } from "@/lib/services/tasks";
import type { TaskWithRelations } from "@/types/database";

type Tab = "deleted" | "archived";

const TAB_STYLE: Record<Tab, { color: string; label: string; icon: typeof Trash2 }> = {
  deleted: { color: "#c23b3b", label: "Excluídas", icon: Trash2 },
  archived: { color: "#e0a900", label: "Arquivadas", icon: Archive },
};

function ago(iso: string | null | undefined) {
  if (!iso) return "";
  try {
    return formatDistanceToNow(parseISO(iso), { locale: ptBR, addSuffix: true });
  } catch {
    return "";
  }
}

export default function TrashPage() {
  const { isManager, isAdmin } = useAuth();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("deleted");
  const [deleted, setDeleted] = useState<TaskWithRelations[]>([]);
  const [archived, setArchived] = useState<TaskWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [toPurge, setToPurge] = useState<TaskWithRelations | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [d, a] = await Promise.all([
        listTasks(supabase, { onlyDeleted: true }),
        listTasks(supabase, { archivedOnly: true }),
      ]);
      setDeleted(d);
      setArchived(a);
    } catch {
      toast.error("Não foi possível carregar a lixeira");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isManager) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager]);

  async function run(id: string, action: () => Promise<unknown>, success: string) {
    setBusyId(id);
    try {
      await action();
      toast.success(success);
      await load();
    } catch {
      toast.error("Não foi possível concluir a ação");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePurge() {
    if (!toPurge) return;
    const target = toPurge;
    setToPurge(null);
    await run(target.id, () => permanentlyDeleteTask(supabase, target.id), "Tarefa excluída permanentemente");
  }

  const list = tab === "deleted" ? deleted : archived;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((t) => t.title.toLowerCase().includes(q) || (t.area?.name ?? "").toLowerCase().includes(q));
  }, [list, query]);

  if (!isManager) {
    return (
      <div>
        <PageHeader title="Lixeira" description="Acesso restrito a Gestores e Master." />
        <Card className="ast-fade-up flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <p className="max-w-sm text-sm text-gray-500">Apenas Gestores e o Master podem restaurar ou excluir tarefas permanentemente.</p>
        </Card>
      </div>
    );
  }

  const style = TAB_STYLE[tab];

  return (
    <div>
      <PageHeader title="Lixeira" description="Tarefas excluídas (recuperáveis) e arquivadas do Marketing." />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          icon={Trash2}
          label="Excluídas"
          value={deleted.length}
          hint="podem ser restauradas"
          color={TAB_STYLE.deleted.color}
          index={0}
          active={tab === "deleted"}
          onClick={() => setTab("deleted")}
        />
        <StatCard
          icon={Archive}
          label="Arquivadas"
          value={archived.length}
          hint="fora do quadro"
          color={TAB_STYLE.archived.color}
          index={1}
          active={tab === "archived"}
          onClick={() => setTab("archived")}
        />
        <StatCard icon={Layers} label="Total guardado" value={deleted.length + archived.length} color="#375367" index={2} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar entre as ${style.label.toLowerCase()}...`}
            aria-label="Buscar na lixeira"
            className="h-11 w-full rounded-full border border-gray-200 bg-white pl-10 pr-9 text-sm text-blue-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-900 focus:shadow-[var(--shadow-focus)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <p className="text-xs font-semibold text-gray-500">
          {filtered.length} {filtered.length === 1 ? "tarefa" : "tarefas"}
        </p>
      </div>

      {loading ? (
        <div className="space-y-2" role="status" aria-label="Carregando lixeira">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="ast-skeleton h-20 rounded-2xl" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={query ? Search : tab === "deleted" ? Trash2 : Archive}
          title={query ? "Nada encontrado" : tab === "deleted" ? "Nenhuma tarefa excluída" : "Nenhuma tarefa arquivada"}
          description={query ? "Tente outro termo de busca." : "Quando algo for " + (tab === "deleted" ? "excluído" : "arquivado") + ", aparece aqui."}
        />
      ) : (
        <div key={tab} className="space-y-2.5">
          {filtered.map((task, i) => {
            const when = tab === "deleted" ? task.deleted_at : task.archived_at;
            const who = tab === "deleted" ? task.deleter?.full_name : task.archiver?.full_name;
            const busy = busyId === task.id;
            return (
              <Card
                key={task.id}
                style={{ animationDelay: `${Math.min(i, 10) * 35}ms`, borderLeftColor: style.color, borderLeftWidth: 4 }}
                className={cn(
                  "kb-card-in flex flex-wrap items-center gap-3 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]",
                  busy && "pointer-events-none opacity-50"
                )}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${style.color}1f`, color: style.color }}
                >
                  <style.icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate text-sm font-bold text-blue-900">{task.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <FolderOpen className="h-3 w-3" />
                      {task.area?.name || "Sem área"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {tab === "deleted" ? "excluída" : "arquivada"} {ago(when)} por {who || "Sistema"}
                    </span>
                  </p>
                </div>
                <PriorityBadge priority={task.priority} />
                <StatusBadge status={task.status} />
                {tab === "deleted" ? (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => run(task.id, () => restoreTask(supabase, task.id), "Tarefa restaurada")} className="gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                    </Button>
                    {isAdmin && (
                      <Button size="sm" variant="danger" onClick={() => setToPurge(task)} className="gap-1.5">
                        <Trash2 className="h-3.5 w-3.5" /> Excluir de vez
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => run(task.id, () => archiveTask(supabase, task.id, false), "Tarefa desarquivada")} className="gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" /> Desarquivar
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!toPurge}
        onClose={() => setToPurge(null)}
        onConfirm={handlePurge}
        title="Excluir permanentemente"
        description={`Isso remove "${toPurge?.title}" para sempre, sem possibilidade de recuperação. Tem certeza?`}
        confirmLabel="Excluir para sempre"
        danger
      />
    </div>
  );
}
