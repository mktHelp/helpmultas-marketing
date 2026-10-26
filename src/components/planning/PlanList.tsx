"use client";

import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { AccountPill, FormatPill, FunnelPill, PendingBadge, StatusPill } from "./planParts";
import { fmtDayMonth, fromKey, weekdayShort } from "@/lib/contentPlan";
import type { ContentPlanPost } from "@/types/database";

/** Cronograma em tabela, no formato do documento do marketing: Data, Dia, Pilar, Tema, Objetivo e Funil. */
export function PlanList({
  posts, showAccount, onOpenPost, onNewPost,
}: {
  posts: ContentPlanPost[];
  showAccount: boolean;
  onOpenPost: (p: ContentPlanPost) => void;
  onNewPost: () => void;
}) {
  if (posts.length === 0) {
    return <EmptyState icon={CalendarDays} title="Nenhum post neste período" description="Mude os filtros ou planeje o primeiro post." actionLabel="Novo post" onAction={onNewPost} />;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-[var(--shadow-sm)]">
      <table className="w-full min-w-[900px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-050 text-[11px] font-bold uppercase tracking-wide text-gray-500">
            <th className="px-3 py-2.5">Data</th>
            <th className="px-3 py-2.5">Dia</th>
            {showAccount && <th className="px-3 py-2.5">Perfil</th>}
            <th className="px-3 py-2.5">Pilar</th>
            <th className="px-3 py-2.5">Tema</th>
            <th className="px-3 py-2.5">Objetivo</th>
            <th className="px-3 py-2.5">Funil</th>
            <th className="px-3 py-2.5">Formato</th>
            <th className="px-3 py-2.5">Etapa</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((p) => (
            <tr key={p.id} onClick={() => onOpenPost(p)} className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-050/70">
              <td className="whitespace-nowrap px-3 py-2.5 font-bold text-blue-900">{fmtDayMonth(p.publish_date)}</td>
              <td className="px-3 py-2.5 text-gray-600">{weekdayShort(fromKey(p.publish_date))}</td>
              {showAccount && <td className="px-3 py-2.5"><AccountPill account={p.account} /></td>}
              <td className="px-3 py-2.5 text-gray-700">{p.pillar ?? "—"}</td>
              <td className="max-w-[320px] px-3 py-2.5 font-semibold text-blue-900">
                <span className="flex items-center gap-1.5"><span className="truncate">{p.theme}</span><PendingBadge post={p} /></span>
              </td>
              <td className="px-3 py-2.5 text-gray-700">{p.objective ?? "—"}</td>
              <td className="px-3 py-2.5">{p.funnel ? <FunnelPill funnel={p.funnel} /> : "—"}</td>
              <td className="px-3 py-2.5"><FormatPill format={p.format} /></td>
              <td className="px-3 py-2.5"><StatusPill status={p.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
