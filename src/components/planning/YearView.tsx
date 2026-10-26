"use client";

import { AlertTriangle } from "lucide-react";
import {
  ACCOUNT_COLOR, ACCOUNT_SHORT, FORMAT_COLOR, FORMAT_LABEL, FUNNEL_COLOR, FUNNEL_LABEL, MONTH_NAMES, openPendingCount, pad,
} from "@/lib/contentPlan";
import type { ContentPlanPost, PlanAccount, PlanFormat, PlanFunnel } from "@/types/database";

/** Visão do ano: um cartão por mês com volume, mix de formatos e funil, e o que ainda está pendente. */
export function YearView({
  year, posts, account, onOpenMonth,
}: {
  year: number;
  posts: ContentPlanPost[];
  account: PlanAccount | "";
  onOpenMonth: (month: number) => void;
}) {
  const now = new Date();
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {MONTH_NAMES.map((name, m) => {
        const prefix = `${year}-${pad(m + 1)}-`;
        const list = posts.filter((p) => p.publish_date.startsWith(prefix));
        const pending = list.reduce((n, p) => n + openPendingCount(p), 0);
        const byFormat = (f: PlanFormat) => list.filter((p) => p.format === f).length;
        const byFunnel = (f: PlanFunnel) => list.filter((p) => p.funnel === f).length;
        const published = list.filter((p) => p.status === "publicado").length;
        const isCurrent = now.getFullYear() === year && now.getMonth() === m;
        const accounts = (account ? [account] : (["franchising", "roberson"] as PlanAccount[]))
          .map((a) => ({ a, n: list.filter((p) => p.account === a).length }));
        return (
          <button
            key={name}
            type="button"
            onClick={() => onOpenMonth(m)}
            className={`rounded-2xl border bg-white p-4 text-left shadow-[var(--shadow-sm)] transition-all hover:border-blue-200 hover:shadow-md active:scale-[0.995] ${
              isCurrent ? "border-yellow-500" : "border-gray-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <h3 className="font-display text-[15px] font-bold text-blue-900">{name}</h3>
              {isCurrent && <span className="rounded-full bg-yellow-500 px-2 py-0.5 text-[10px] font-bold text-blue-900">Este mês</span>}
              {pending > 0 && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-[color:var(--color-danger)]">
                  <AlertTriangle className="h-3 w-3" /> {pending}
                </span>
              )}
            </div>

            {list.length === 0 ? (
              <p className="mt-3 text-[13px] text-gray-400">Nada planejado ainda.</p>
            ) : (
              <>
                <p className="mt-2 text-2xl font-bold text-blue-900">
                  {list.length} <span className="text-[13px] font-semibold text-gray-500">{list.length === 1 ? "post" : "posts"}</span>
                </p>
                <p className="text-[12px] text-gray-500">
                  {(["reels", "carrossel", "feed"] as PlanFormat[])
                    .filter(byFormat)
                    .map((f) => `${byFormat(f)} ${FORMAT_LABEL[f]}`)
                    .join(" · ")}
                  {published > 0 && ` · ${published} publicado${published > 1 ? "s" : ""}`}
                </p>

                <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-gray-100" aria-label="Mix do funil">
                  {(["topo", "meio", "fundo"] as PlanFunnel[]).map((f) =>
                    byFunnel(f) ? <span key={f} style={{ width: `${(byFunnel(f) / list.length) * 100}%`, backgroundColor: FUNNEL_COLOR[f] }} title={`${FUNNEL_LABEL[f]}: ${byFunnel(f)}`} /> : null
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-gray-500">
                  {(["topo", "meio", "fundo"] as PlanFunnel[]).filter(byFunnel).map((f) => (
                    <span key={f}>
                      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: FUNNEL_COLOR[f] }} />
                      {FUNNEL_LABEL[f]} {byFunnel(f)}
                    </span>
                  ))}
                </div>

                {/* um ponto por dia com post, colorido pelo formato */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {list.map((p) => (
                    <span key={p.id} className="h-2.5 w-2.5 rounded-sm" title={`${p.publish_date.slice(8)}/${pad(m + 1)} · ${p.theme}`} style={{ backgroundColor: FORMAT_COLOR[p.format] }} />
                  ))}
                </div>

                {!account && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                    {accounts.map(({ a, n }) => (
                      <span key={a} style={{ color: ACCOUNT_COLOR[a] }}>
                        {ACCOUNT_SHORT[a]} {n}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
