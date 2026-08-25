"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RotateCcw, Trash2, Archive } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PriorityBadge, StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { archiveTask, listTasks, permanentlyDeleteTask, restoreTask } from "@/lib/services/tasks";
import type { TaskWithRelations } from "@/types/database";

export default function TrashPage() {
  const { isManager, isAdmin } = useAuth();
  const supabase = createClient();
  const [tab, setTab] = useState<"deleted" | "archived">("deleted");
  const [deleted, setDeleted] = useState<TaskWithRelations[]>([]);
  const [archived, setArchived] = useState<TaskWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [toPurge, setToPurge] = useState<TaskWithRelations | null>(null);

  async function load() {
    setLoading(true);
    const [d, a] = await Promise.all([
      listTasks(supabase, { onlyDeleted: true }),
      listTasks(supabase, { archivedOnly: true }),
    ]);
    setDeleted(d);
    setArchived(a);
    setLoading(false);
  }

  useEffect(() => {
    if (isManager) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager]);

  async function handleRestore(id: string) {
    await restoreTask(supabase, id);
    toast.success("Tarefa restaurada");
    load();
  }

  async function handleUnarchive(id: string) {
    await archiveTask(supabase, id, false);
    toast.success("Tarefa desarquivada");
    load();
  }

  async function handlePurge() {
    if (!toPurge) return;
    await permanentlyDeleteTask(supabase, toPurge.id);
    toast.success("Tarefa excluída permanentemente");
    setToPurge(null);
    load();
  }

  if (!isManager) {
    return (
      <div>
        <PageHeader title="Lixeira" description="Acesso restrito a Gestores e Master." />
        <Card className="p-8 text-center text-sm text-gray-500">
          Apenas Gestores e o Master podem restaurar ou excluir tarefas permanentemente.
        </Card>
      </div>
    );
  }

  const list = tab === "deleted" ? deleted : archived;

  return (
    <div>
      <PageHeader
        title="Lixeira"
        description="Tarefas excluídas (recuperáveis) e arquivadas do Marketing."
      />

      <div className="mb-4">
        <Tabs
          tabs={[
            { key: "deleted", label: "Excluídas", count: deleted.length },
            { key: "archived", label: "Arquivadas", count: archived.length },
          ]}
          active={tab}
          onChange={(k) => setTab(k as "deleted" | "archived")}
        />
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Carregando...</div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={tab === "deleted" ? Trash2 : Archive}
          title={tab === "deleted" ? "Nenhuma tarefa excluída" : "Nenhuma tarefa arquivada"}
        />
      ) : (
        <div className="space-y-2">
          {list.map((task) => (
            <Card key={task.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-blue-900">{task.title}</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {task.area?.name || "Sem área"} ·{" "}
                  {tab === "deleted" ? `excluída em ${formatDate(task.deleted_at)}` : `arquivada em ${formatDate(task.archived_at)}`}
                </p>
              </div>
              <PriorityBadge priority={task.priority} />
              <StatusBadge status={task.status} />
              {tab === "deleted" ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => handleRestore(task.id)} className="gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                  </Button>
                  {isAdmin && (
                    <Button size="sm" variant="danger" onClick={() => setToPurge(task)} className="gap-1.5">
                      <Trash2 className="h-3.5 w-3.5" /> Excluir de vez
                    </Button>
                  )}
                </div>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => handleUnarchive(task.id)} className="gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" /> Desarquivar
                </Button>
              )}
            </Card>
          ))}
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
