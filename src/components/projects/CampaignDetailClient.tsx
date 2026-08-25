"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TaskTable } from "@/components/tasks/TaskTable";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { createClient } from "@/lib/supabase/client";
import { getCampaign, type CampaignWithOwner } from "@/lib/services/projects";
import { listTasks } from "@/lib/services/tasks";
import { listProfiles } from "@/lib/services/profiles";
import { useAuth } from "@/lib/auth-context";
import { CAMPAIGN_STATUS_LABELS } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import type { Profile, TaskWithRelations } from "@/types/database";

export function CampaignDetailClient({ campaignId }: { campaignId: string }) {
  const { isManager } = useAuth();
  const supabase = createClient();
  const [campaign, setCampaign] = useState<CampaignWithOwner | null>(null);
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    const [c, t, p] = await Promise.all([
      getCampaign(supabase, campaignId),
      listTasks(supabase, { campaignId }),
      listProfiles(supabase),
    ]);
    setCampaign(c);
    setTasks(t);
    setProfiles(p);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  if (!campaign) return <div className="py-16 text-center text-sm text-gray-400">Carregando...</div>;

  return (
    <div>
      <Link href="/campaigns" className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-blue-900">
        <ArrowLeft className="h-4 w-4" /> Voltar para campanhas
      </Link>

      <PageHeader
        title={campaign.name}
        description={campaign.objective}
        action={<Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Nova tarefa</Button>}
      />

      <Card className="mb-6 p-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Info label="Status" value={CAMPAIGN_STATUS_LABELS[campaign.status as keyof typeof CAMPAIGN_STATUS_LABELS]} />
          <Info label="Orçamento" value={campaign.budget ? `R$ ${Number(campaign.budget).toLocaleString("pt-BR")}` : "-"} />
          <Info label="Período" value={`${formatDate(campaign.start_date)} — ${formatDate(campaign.end_date)}`} />
          <div>
            <p className="text-xs font-bold uppercase text-gray-500">Responsável</p>
            {campaign.owner && (
              <div className="mt-1 flex items-center gap-2">
                <UserAvatar name={campaign.owner.full_name} avatarUrl={campaign.owner.avatar_url} size="xs" />
                <span className="text-sm font-semibold text-blue-900">{campaign.owner.full_name}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      <h3 className="mb-3 font-display text-base font-bold text-blue-900">Tarefas da campanha</h3>
      <TaskTable tasks={tasks} profiles={profiles} onRefresh={load} canDelete={isManager} />

      <CreateTaskModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} defaultCampaignId={campaignId} />
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
