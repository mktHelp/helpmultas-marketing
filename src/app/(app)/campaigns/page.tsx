"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpRight, Megaphone, PauseCircle, PencilLine, PlayCircle, Plus, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { EditableDate, EditableSelect, EditableText } from "@/components/ui/EditableCell";
import { ViewToggle, usePersistentView } from "@/components/ui/ViewToggle";
import { CampaignFormModal } from "@/components/projects/CampaignFormModal";
import { createClient } from "@/lib/supabase/client";
import { listCampaigns, updateCampaign, type CampaignWithOwner } from "@/lib/services/projects";
import { CAMPAIGN_STATUS_LABELS } from "@/components/shared/StatusBadge";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { BRAND } from "@/lib/chart-theme";
import { formatDate } from "@/lib/utils";
import type { Campaign, CampaignStatus } from "@/types/database";

const STATUS_COLOR: Record<CampaignStatus, string> = { planejamento: "#7c8e98", ativa: "#2f8f5b", pausada: "#c99400", encerrada: "#4a6a80" };
const STATUS_OPTIONS = (Object.keys(CAMPAIGN_STATUS_LABELS) as CampaignStatus[]).map((k) => ({ value: k, label: CAMPAIGN_STATUS_LABELS[k], color: STATUS_COLOR[k] }));

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function CampaignsPage() {
  const supabase = createClient();
  const [campaigns, setCampaigns] = useState<CampaignWithOwner[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = usePersistentView("hm-campaigns-view", "table", ["table", "cards"] as const);

  const load = useCallback(async () => {
    setCampaigns(await listCampaigns(supabase));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeChanges(["campaigns"], load);

  async function save(id: string, patch: Partial<Campaign>, message: string) {
    try {
      await updateCampaign(supabase, id, patch);
      setCampaigns((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      toast.success(message);
    } catch (e) {
      toast.error("Não foi possível salvar a alteração");
      throw e;
    }
  }

  const activeCount = campaigns.filter((c) => c.status === "ativa").length;
  const paused = campaigns.filter((c) => c.status === "pausada").length;
  const budget = campaigns.filter((c) => c.status !== "encerrada").reduce((s, c) => s + Number(c.budget ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Campanhas"
        description="Planeje e acompanhe as campanhas de marketing."
        action={
          <>
            <ViewToggle value={view} onChange={(k) => setView(k as typeof view)} />
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Nova campanha</Button>
          </>
        }
      />

      {campaigns.length === 0 ? (
        <EmptyState icon={Megaphone} title="Nenhuma campanha ainda" actionLabel="Criar campanha" onAction={() => setCreateOpen(true)} />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard index={0} icon={Megaphone} label="Campanhas" value={campaigns.length} color={BRAND.blue} />
            <StatCard index={1} icon={PlayCircle} label="Ativas" value={activeCount} color={BRAND.green} />
            <StatCard index={2} icon={PauseCircle} label="Pausadas" value={paused} color="#c99400" />
            <StatCard index={3} icon={Wallet} label="Verba em aberto (R$)" value={Math.round(budget)} hint="soma das não encerradas" color={BRAND.steel} />
          </div>

          {view === "table" ? (
            <div className="ast-fade-up overflow-hidden rounded-2xl border border-gray-200/80 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
                <span><b className="text-blue-900">{campaigns.length}</b> campanha{campaigns.length === 1 ? "" : "s"}</span>
                <span className="hidden items-center gap-1.5 sm:flex"><PencilLine className="h-3.5 w-3.5" /> Clique em uma célula para editar</span>
              </div>
              <div className="overflow-x-auto">
                <table className="erp-table min-w-[1000px]">
                  <thead>
                    <tr>
                      <th>Campanha</th>
                      <th>Objetivo</th>
                      <th>Status</th>
                      <th className="num">Verba</th>
                      <th>Responsável</th>
                      <th>Início</th>
                      <th>Fim</th>
                      <th className="w-10" aria-label="Abrir" />
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.id} className="group">
                        <td className="min-w-[220px] max-w-[320px]">
                          <EditableText value={c.name} ariaLabel="nome da campanha" className="font-semibold" onSave={(name) => (name ? save(c.id, { name }, "Campanha renomeada") : undefined)} />
                        </td>
                        <td className="min-w-[200px] max-w-[300px] text-gray-700">
                          <EditableText value={c.objective ?? ""} ariaLabel="objetivo" placeholder="Definir objetivo" onSave={(objective) => save(c.id, { objective: objective || null }, "Objetivo atualizado")} />
                        </td>
                        <td>
                          <EditableSelect value={c.status} options={STATUS_OPTIONS} ariaLabel="status" onSave={(status) => save(c.id, { status: status as CampaignStatus }, "Status atualizado")} />
                        </td>
                        <td className="num w-36">
                          <EditableText
                            type="number"
                            value={c.budget != null ? String(c.budget) : ""}
                            ariaLabel="verba"
                            format={(v) => money.format(Number(v))}
                            onSave={(v) => {
                              const n = v === "" ? null : Number(v.replace(",", "."));
                              if (n != null && Number.isNaN(n)) return;
                              return save(c.id, { budget: n }, "Verba atualizada");
                            }}
                          />
                        </td>
                        <td>
                          {c.owner ? (
                            <span className="flex items-center gap-2 whitespace-nowrap">
                              <UserAvatar name={c.owner.full_name} avatarUrl={c.owner.avatar_url} size="xs" />
                              <span className="truncate text-gray-700">{c.owner.full_name}</span>
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="text-gray-700">
                          <EditableDate value={c.start_date} ariaLabel="início" display={formatDate} onSave={(start_date) => save(c.id, { start_date }, "Início atualizado")} />
                        </td>
                        <td className="text-gray-700">
                          <EditableDate value={c.end_date} ariaLabel="fim" display={formatDate} onSave={(end_date) => save(c.id, { end_date }, "Fim atualizado")} />
                        </td>
                        <td className="!pr-3 text-right">
                          <Link href={`/campaigns/${c.id}`} aria-label={`Abrir ${c.name}`} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-900">
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((c) => (
                <Link key={c.id} href={`/campaigns/${c.id}`}>
                  <Card className="h-full p-5 transition-shadow hover:shadow-[var(--shadow-md)]">
                    <div className="flex items-center justify-between">
                      <Badge tone={c.status === "ativa" ? "success" : "info"}>
                        {CAMPAIGN_STATUS_LABELS[c.status as keyof typeof CAMPAIGN_STATUS_LABELS]}
                      </Badge>
                      {c.owner && <UserAvatar name={c.owner.full_name} avatarUrl={c.owner.avatar_url} size="xs" />}
                    </div>
                    <h3 className="mt-3 font-display text-[15px] font-semibold text-blue-900">{c.name}</h3>
                    {c.objective && <p className="mt-1 line-clamp-2 text-[13px] text-gray-500">{c.objective}</p>}
                    <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                      {c.budget && <span>{money.format(Number(c.budget))}</span>}
                      {c.end_date && <span>até {formatDate(c.end_date)}</span>}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <CampaignFormModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
    </div>
  );
}
