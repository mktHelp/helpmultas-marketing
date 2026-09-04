"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TaskTable } from "@/components/tasks/TaskTable";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { CreativesTable } from "@/components/projects/CreativesTable";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Tabs } from "@/components/ui/Tabs";
import { createClient } from "@/lib/supabase/client";
import { getProject, type ProjectWithOwner } from "@/lib/services/projects";
import { listTasks } from "@/lib/services/tasks";
import { listProfiles } from "@/lib/services/profiles";
import { useAuth } from "@/lib/auth-context";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { PROJECT_STATUS_LABELS } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import type { Profile, TaskWithRelations } from "@/types/database";

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const { isManager } = useAuth();
  const supabase = createClient();
  const [project, setProject] = useState<ProjectWithOwner | null>(null);
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [tab, setTab] = useState("tasks");

  async function load() {
    const [p, t, pr] = await Promise.all([
      getProject(supabase, projectId),
      listTasks(supabase, { projectId }),
      listProfiles(supabase),
    ]);
    setProject(p);
    setTasks(t);
    setProfiles(pr);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useRealtimeChanges(["tasks", "task_assignees", "projects"], load, {
    filters: { tasks: `project_id=eq.${projectId}`, projects: `id=eq.${projectId}` },
  });

  if (!project) return <div className="py-16 text-center text-sm text-gray-400">Carregando...</div>;

  return (
    <div>
      <Link href="/projects" className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-blue-900">
        <ArrowLeft className="h-4 w-4" /> Voltar para projetos
      </Link>

      <PageHeader
        title={project.name}
        description={project.description}
        action={<Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Nova tarefa</Button>}
      />

      <Card className="mb-6 p-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Info label="Status" value={PROJECT_STATUS_LABELS[project.status as keyof typeof PROJECT_STATUS_LABELS]} />
          <Info label="Progresso" value={`${project.progress}%`} />
          <Info label="Entrega" value={formatDate(project.end_date)} />
          <div>
            <p className="text-xs font-bold uppercase text-gray-500">Responsável</p>
            {project.owner && (
              <div className="mt-1 flex items-center gap-2">
                <UserAvatar name={project.owner.full_name} avatarUrl={project.owner.avatar_url} size="xs" />
                <span className="text-sm font-semibold text-blue-900">{project.owner.full_name}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Tabs
        className="mb-4"
        tabs={[
          { key: "tasks", label: "Tarefas" },
          { key: "creatives", label: "Criativos" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "tasks" && <TaskTable tasks={tasks} profiles={profiles} onRefresh={load} canDelete={isManager} />}
      {tab === "creatives" && <CreativesTable projectId={projectId} profiles={profiles} />}

      <CreateTaskModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} defaultProjectId={projectId} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-blue-900">{value}</p>
    </div>
  );
}
