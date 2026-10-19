"use client";

import { AlertTriangle, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACCOUNT_COLOR, ACCOUNT_SHORT, FORMAT_COLOR, FORMAT_LABEL, FUNNEL_COLOR, FUNNEL_LABEL, STATUS_COLOR, STATUS_LABEL, openPendingCount,
} from "@/lib/contentPlan";
import type { ContentPlanPost, PlanFormat, PlanFunnel, PlanStatus } from "@/types/database";

export function Pill({ label, color, className }: { label: string; color: string; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold leading-none", className)}
      style={{ backgroundColor: `${color}1f`, color }}
    >
      {label}
    </span>
  );
}

export const FormatPill = ({ format }: { format: PlanFormat }) => <Pill label={FORMAT_LABEL[format]} color={FORMAT_COLOR[format]} />;
export const FunnelPill = ({ funnel }: { funnel: PlanFunnel }) => <Pill label={FUNNEL_LABEL[funnel]} color={FUNNEL_COLOR[funnel]} />;
export const StatusPill = ({ status }: { status: PlanStatus }) => <Pill label={STATUS_LABEL[status]} color={STATUS_COLOR[status]} />;
export const AccountPill = ({ account }: { account: ContentPlanPost["account"] }) => (
  <Pill label={ACCOUNT_SHORT[account]} color={ACCOUNT_COLOR[account]} />
);

/** Selo de pendências em aberto (dados a confirmar antes de gravar). */
export function PendingBadge({ post }: { post: Pick<ContentPlanPost, "pending"> }) {
  const n = openPendingCount(post);
  if (!n) return null;
  return (
    <span
      title={`${n} ${n === 1 ? "pendência" : "pendências"} antes de gravar`}
      className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10.5px] font-bold leading-none text-[color:var(--color-danger)]"
    >
      <AlertTriangle className="h-2.5 w-2.5" /> {n}
    </span>
  );
}

/** Cartão compacto de um post (calendário, semana). A barra à esquerda leva a cor do perfil. */
export function PostChip({
  post, onClick, showAccount, className,
}: {
  post: ContentPlanPost;
  onClick: () => void;
  showAccount?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-left shadow-[var(--shadow-sm)] transition-all hover:border-blue-200 hover:shadow-md active:scale-[0.99]",
        className
      )}
      style={{ borderLeft: `3px solid ${showAccount ? ACCOUNT_COLOR[post.account] : FORMAT_COLOR[post.format]}` }}
    >
      <span className="flex items-center gap-1">
        <span className="min-w-0 flex-1 truncate text-[10.5px] font-bold uppercase tracking-wide text-gray-500">
          {post.pillar || FORMAT_LABEL[post.format]}
        </span>
        {post.pinned_slot && <Pin className="h-3 w-3 shrink-0 text-yellow-600" aria-label={`Fixado ${post.pinned_slot}`} />}
        <PendingBadge post={post} />
      </span>
      <span className="mt-0.5 line-clamp-2 block text-[12px] font-semibold leading-snug text-blue-900">{post.theme}</span>
      <span className="mt-1 flex flex-wrap items-center gap-1">
        <FormatPill format={post.format} />
        {post.funnel && <FunnelPill funnel={post.funnel} />}
        {showAccount && <AccountPill account={post.account} />}
        <span className="ml-auto h-2 w-2 rounded-full" title={STATUS_LABEL[post.status]} style={{ backgroundColor: STATUS_COLOR[post.status] }} />
      </span>
    </button>
  );
}

/** Texto do roteiro com os trechos [CONFIRMAR: ...] destacados. */
export function RoteiroText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\[CONFIRMAR[^\]]*\])/gi);
  return (
    <p className={cn("whitespace-pre-wrap text-[13.5px] leading-relaxed text-gray-800", className)}>
      {parts.map((part, i) =>
        /^\[CONFIRMAR/i.test(part) ? (
          <mark key={i} className="rounded bg-yellow-100 px-1 font-semibold text-yellow-900">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}
