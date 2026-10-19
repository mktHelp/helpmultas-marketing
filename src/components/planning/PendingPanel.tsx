"use client";

import { CheckCircle2, ClipboardCheck } from "lucide-react";
import { AccountPill } from "./planParts";
import { fmtDayMonth, openPendingCount } from "@/lib/contentPlan";
import { cn } from "@/lib/utils";
import type { ContentPlanPost } from "@/types/database";

/** "Pendências antes de gravar": tudo que o Rober (ou a equipe) precisa confirmar, por post. Marcar aqui já atualiza o post. */
export function PendingPanel({
  posts, onOpenPost, onToggle, title = "Pendências antes de gravar",
}: {
  posts: ContentPlanPost[];
  onOpenPost: (p: ContentPlanPost) => void;
  onToggle: (post: ContentPlanPost, index: number) => void;
  title?: string;
}) {
  const withPending = posts.filter((p) => p.pending.length > 0 && p.status !== "publicado");
  const open = posts.reduce((n, p) => n + (p.status === "publicado" ? 0 : openPendingCount(p)), 0);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-blue-700" />
        <h3 className="font-display text-[13px] font-bold text-blue-900">{title}</h3>
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold",
            open ? "bg-red-50 text-[color:var(--color-danger)]" : "bg-green-50 text-green-700"
          )}
        >
          {open ? `${open} em aberto` : "Tudo confirmado"}
        </span>
      </div>

      {withPending.length === 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-[13px] text-gray-500">
          <CheckCircle2 className="h-4 w-4 text-green-600" /> Nenhum dado a confirmar neste período.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {withPending.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onOpenPost(p)} className="flex w-full items-center gap-1.5 text-left">
                <span className="text-[11px] font-bold text-gray-500">{fmtDayMonth(p.publish_date)}</span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-blue-900 hover:underline">{p.theme}</span>
                <AccountPill account={p.account} />
              </button>
              <ul className="mt-1 space-y-1">
                {p.pending.map((item, i) => (
                  <li key={i}>
                    <label className="flex cursor-pointer items-start gap-2 text-[12.5px] leading-snug text-gray-700">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => onToggle(p, i)}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#e0a900]"
                      />
                      <span className={cn(item.done && "text-gray-400 line-through")}>{item.text}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
