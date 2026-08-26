"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Megaphone } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { CampaignFormModal } from "@/components/projects/CampaignFormModal";
import { createClient } from "@/lib/supabase/client";
import { listCampaigns, type CampaignWithOwner } from "@/lib/services/projects";
import { CAMPAIGN_STATUS_LABELS } from "@/components/shared/StatusBadge";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { formatDate } from "@/lib/utils";

export default function CampaignsPage() {
  const supabase = createClient();
  const [campaigns, setCampaigns] = useState<CampaignWithOwner[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setCampaigns(await listCampaigns(supabase));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeChanges(["campaigns"], load);

  return (
    <div>
      <PageHeader
        title="Campanhas"
        description="Planeje e acompanhe as campanhas de marketing."
        action={<Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Nova campanha</Button>}
      />

      {campaigns.length === 0 ? (
        <EmptyState icon={Megaphone} title="Nenhuma campanha ainda" actionLabel="Criar campanha" onAction={() => setCreateOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <Link key={c.id} href={`/campaigns/${c.id}`}>
              <Card className="p-5 hover:shadow-[var(--shadow-md)] transition-shadow h-full">
                <div className="flex items-center justify-between">
                  <Badge tone={c.status === "ativa" ? "success" : "info"}>
                    {CAMPAIGN_STATUS_LABELS[c.status as keyof typeof CAMPAIGN_STATUS_LABELS]}
                  </Badge>
                  {c.owner && <UserAvatar name={c.owner.full_name} avatarUrl={c.owner.avatar_url} size="xs" />}
                </div>
                <h3 className="mt-3 font-display text-base font-bold text-blue-900">{c.name}</h3>
                {c.objective && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{c.objective}</p>}
                <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                  {c.budget && <span>R$ {Number(c.budget).toLocaleString("pt-BR")}</span>}
                  {c.end_date && <span>até {formatDate(c.end_date)}</span>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CampaignFormModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
    </div>
  );
}
