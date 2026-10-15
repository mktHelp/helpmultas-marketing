"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ArrowUpRight, CheckCircle2, FolderKanban, PencilLine, PlayCircle, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { EditableDate, EditableSelect, EditableText } from "@/components/ui/EditableCell";
import { ViewToggle, usePersistentView } from "@/components/ui/ViewToggle";
import { ProjectFormModal } from "@/components/projects/ProjectFormModal";
import { createClient } from "@/lib/supabase/client";
import { listProjects, updateProject, type ProjectWithOwner } from "@/lib/services/projects";
import { PROJECT_STATUS_LABELS, PRIORITY_LABELS } from "@/components/shared/StatusBadge";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { BRAND } from "@/lib/chart-theme";
import { formatDate } from "@/lib/utils";
import type { Project, ProjectStatus, TaskPriority } from "@/types/database";

const STATUS_COLOR: Record<ProjectStatus, string> = {
  planejamento: "#7c8e98",
  em_andamento: "#4a6a80",
  pausado: "#c99400",
  concluido: "#2f8f5b",
  cancelado: "#c23b3b",
};
const STATUS_OPTIONS = (Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((k) => ({ value: k, label: PROJECT_STATUS_LABELS[k], color: STATUS_COLOR[k] }));
const PRIORITY_COLOR: Record<TaskPriority, string> = { urgente: "#c23b3b", alta: "#d9822b", media: "#4a6a80", baixa: "#7c8e98" };
const PRIORITY_OPTIONS = (["urgente", "alta", "media", "baixa"] as TaskPriority[]).map((p) => ({ value: p, label: PRIORITY_LABELS[p], color: PRIORITY_COLOR[p] }));

const today = () => new Date().toISOString().slice(0, 10);
const isLate = (p: ProjectWithOwner) => !!p.end_date && p.end_date.slice(0, 10) < today() && p.status !== "concluido" && p.status !== "cancelado";

export default function ProjectsPage() {
  const supabase = createClient();
  const [projects, setProjects] = useState<ProjectWithOwner[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = usePersistentView("hm-projects-view", "table", ["table", "cards"] as const);
  // tarefas por projeto: total e concluídas (o progresso sai delas)
  const [counts, setCounts] = useState<Record<string, { total: number; done: number }>>({});

  const load = useCallback(async () => {
    setProjects(await listProjects(supabase));
    const { data } = await supabase.from("tasks").select("project_id, completed_at").not("project_id", "is", null).is("deleted_at", null).eq("is_archived", false);
    const c: Record<string, { total: number; done: number }> = {};
    for (const t of (data ?? []) as { project_id: string; completed_at: string | null }[]) {
      const x = (c[t.project_id] ??= { total: 0, done: 0 });
      x.total++;
      if (t.completed_at) x.done++;
    }
    setCounts(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeChanges(["projects", "tasks"], load);

  async function save(id: string, patch: Partial<Project>, message: string) {
    try {
      await updateProject(supabase, id, patch);
      setProjects((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      toast.success(message);
    } catch (e) {
      toast.error("Não foi possível salvar a alteração");
      throw e;
    }
  }

  const progressOf = (p: ProjectWithOwner) => {
    const n = counts[p.id] ?? { total: 0, done: 0 };
    return { ...n, pct: n.total ? Math.round((n.done / n.total) * 100) : p.progress };
  };

  const active = projects.filter((p) => p.status === "em_andamento").length;
  const done = projects.filter((p) => p.status === "concluido").length;
  const late = projects.filter(isLate).length;

  return (
    <div>
      <PageHeader
        title="Projetos"
        description="Acompanhe as iniciativas do Marketing de ponta a ponta."
        action={
          <>
            <ViewToggle value={view} onChange={(k) => setView(k as typeof view)} />
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Novo projeto</Button>
          </>
        }
      />

      {projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="Nenhum projeto ainda" actionLabel="Criar projeto" onAction={() => setCreateOpen(true)} />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard index={0} icon={FolderKanban} label="Projetos" value={projects.length} color={BRAND.blue} />
            <StatCard index={1} icon={PlayCircle} label="Em andamento" value={active} color={BRAND.steel} />
            <StatCard index={2} icon={CheckCircle2} label="Concluídos" value={done} color={BRAND.green} />
            <StatCard index={3} icon={AlertTriangle} label="Com entrega vencida" value={late} color={BRAND.red} />
          </div>

          {view === "table" ? (
            <div className="ast-fade-up overflow-hidden rounded-2xl border border-gray-200/80 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
                <span><b className="text-blue-900">{projects.length}</b> projeto{projects.length === 1 ? "" : "s"}</span>
                <span className="hidden items-center gap-1.5 sm:flex"><PencilLine className="h-3.5 w-3.5" /> Clique em uma célula para editar</span>
              </div>
              <div className="overflow-x-auto">
                <table className="erp-table min-w-[980px]">
                  <thead>
                    <tr>
                      <th>Projeto</th>
                      <th>Status</th>
                      <th>Prioridade</th>
                      <th>Responsável</th>
                      <th>Início</th>
                      <th>Entrega</th>
                      <th className="w-48">Progresso</th>
                      <th className="w-10" aria-label="Abrir" />
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => {
                      const prog = progressOf(p);
                      const late = isLate(p);
                      return (
                        <tr key={p.id} className="group">
                          <td className="min-w-[240px] max-w-[380px]">
                            <EditableText value={p.name} ariaLabel="nome do projeto" className="font-semibold" onSave={(name) => (name ? save(p.id, { name }, "Projeto renomeado") : undefined)} />
                          </td>
                          <td>
                            <EditableSelect value={p.status} options={STATUS_OPTIONS} ariaLabel="status" onSave={(status) => save(p.id, { status: status as ProjectStatus }, "Status atualizado")} />
                          </td>
                          <td>
                            <EditableSelect value={p.priority} options={PRIORITY_OPTIONS} ariaLabel="prioridade" onSave={(priority) => save(p.id, { priority: priority as TaskPriority }, "Prioridade atualizada")} />
                          </td>
                          <td>
                            {p.owner ? (
                              <span className="flex items-center gap-2 whitespace-nowrap">
                                <UserAvatar name={p.owner.full_name} avatarUrl={p.owner.avatar_url} size="xs" />
                                <span className="truncate text-gray-700">{p.owner.full_name}</span>
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="text-gray-700">
                            <EditableDate value={p.start_date} ariaLabel="início" display={formatDate} onSave={(start_date) => save(p.id, { start_date }, "Início atualizado")} />
                          </td>
                          <td className={late ? "font-semibold text-[color:var(--color-danger)]" : "text-gray-700"}>
                            <EditableDate
                              value={p.end_date}
                              ariaLabel="entrega"
                              display={(d) => (
                                <span className="flex items-center gap-1">
                                  {late && <AlertTriangle className="h-3.5 w-3.5" />}
                                  {formatDate(d)}
                                </span>
                              )}
                              onSave={(end_date) => save(p.id, { end_date }, "Entrega atualizada")}
                            />
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 rounded-full bg-gray-100">
                                <div className="h-1.5 rounded-full bg-yellow-500" style={{ width: `${prog.pct}%` }} />
                              </div>
                              <span className="w-9 text-right text-xs font-bold tabular-nums text-blue-900">{prog.pct}%</span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-gray-400">{prog.done}/{prog.total} tarefas</p>
                          </td>
                          <td className="!pr-3 text-right">
                            <Link href={`/projects/${p.id}`} aria-label={`Abrir ${p.name}`} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-900">
                              <ArrowUpRight className="h-4 w-4" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => {
                const prog = progressOf(p);
                return (
                  <Link key={p.id} href={`/projects/${p.id}`}>
                    <Card className="h-full p-5 transition-shadow hover:shadow-[var(--shadow-md)]">
                      <div className="flex items-center justify-between">
                        <Badge tone="info">{PROJECT_STATUS_LABELS[p.status as keyof typeof PROJECT_STATUS_LABELS]}</Badge>
                        {p.owner && <UserAvatar name={p.owner.full_name} avatarUrl={p.owner.avatar_url} size="xs" />}
                      </div>
                      <h3 className="mt-3 font-display text-[15px] font-semibold text-blue-900">{p.name}</h3>
                      {p.description && <p className="mt-1 line-clamp-2 text-[13px] text-gray-500">{p.description}</p>}
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{prog.total} {prog.total === 1 ? "tarefa" : "tarefas"}{prog.total ? ` · ${prog.done} concluída${prog.done === 1 ? "" : "s"}` : ""}</span>
                          <span className="font-semibold text-blue-900">{prog.pct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                          <div className="h-1.5 rounded-full bg-yellow-500" style={{ width: `${prog.pct}%` }} />
                        </div>
                      </div>
                      {p.end_date && <p className="mt-3 text-xs text-gray-400">Entrega: {formatDate(p.end_date)}</p>}
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      <ProjectFormModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
    </div>
  );
}
