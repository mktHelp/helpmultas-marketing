"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProjectFormModal } from "@/components/projects/ProjectFormModal";
import { createClient } from "@/lib/supabase/client";
import { listProjects, type ProjectWithOwner } from "@/lib/services/projects";
import { PROJECT_STATUS_LABELS } from "@/components/shared/StatusBadge";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { formatDate } from "@/lib/utils";
import { FolderKanban } from "lucide-react";

export default function ProjectsPage() {
  const supabase = createClient();
  const [projects, setProjects] = useState<ProjectWithOwner[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setProjects(await listProjects(supabase));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeChanges(["projects"], load);

  return (
    <div>
      <PageHeader
        title="Projetos"
        description="Acompanhe as iniciativas do Marketing de ponta a ponta."
        action={<Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Novo projeto</Button>}
      />

      {projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="Nenhum projeto ainda" actionLabel="Criar projeto" onAction={() => setCreateOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="p-5 hover:shadow-[var(--shadow-md)] transition-shadow h-full">
                <div className="flex items-center justify-between">
                  <Badge tone="info">{PROJECT_STATUS_LABELS[p.status as keyof typeof PROJECT_STATUS_LABELS]}</Badge>
                  {p.owner && <UserAvatar name={p.owner.full_name} avatarUrl={p.owner.avatar_url} size="xs" />}
                </div>
                <h3 className="mt-3 font-display text-base font-bold text-blue-900">{p.name}</h3>
                {p.description && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{p.description}</p>}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Progresso</span>
                    <span className="font-semibold text-blue-900">{p.progress}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                    <div className="h-1.5 rounded-full bg-yellow-500" style={{ width: `${p.progress}%` }} />
                  </div>
                </div>
                {p.end_date && <p className="mt-3 text-xs text-gray-400">Entrega: {formatDate(p.end_date)}</p>}
              </Card>
            </Link>
          ))}
        </div>
      )}

      <ProjectFormModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
    </div>
  );
}
