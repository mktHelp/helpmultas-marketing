"use client";

import { useState } from "react";
import { ClipboardCopy, ExternalLink, Pencil, Pin, Plus } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AccountPill, FormatPill, FunnelPill, PendingBadge, RoteiroText, StatusPill } from "./planParts";
import { StoriesEditor } from "./StoriesEditor";
import { scriptToText, toKey } from "@/lib/contentPlan";
import { CalendarDays } from "lucide-react";
import type { ContentPlanPost, ContentPlanStory, PlanAccount } from "@/types/database";

function PostReader({ post, onEdit }: { post: ContentPlanPost; onEdit: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(scriptToText(post));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[var(--shadow-sm)] sm:p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <FormatPill format={post.format} />
        {post.funnel && <FunnelPill funnel={post.funnel} />}
        <AccountPill account={post.account} />
        <StatusPill status={post.status} />
        <PendingBadge post={post} />
        {post.pinned_slot && (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10.5px] font-bold text-yellow-800">
            <Pin className="h-3 w-3" /> Fixado {String(post.pinned_slot).padStart(2, "0")}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {post.task_id && (
            <Link href={`/tasks/${post.task_id}`} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-bold text-blue-700 hover:bg-gray-100">
              <ExternalLink className="h-3 w-3" /> Tarefa
            </Link>
          )}
          <Button size="sm" variant="secondary" onClick={copy} className="gap-1.5"><ClipboardCopy className="h-3.5 w-3.5" /> {copied ? "Copiado" : "Copiar roteiro"}</Button>
          <Button size="sm" variant="dark" onClick={onEdit} className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> Editar</Button>
        </div>
      </div>

      <h3 className="mt-2 font-display text-[17px] font-bold leading-snug text-blue-900">{post.theme}</h3>
      <p className="mt-0.5 text-[12.5px] text-gray-500">
        {[post.pillar && `Pilar: ${post.pillar}`, post.objective && `Objetivo: ${post.objective}`, post.duration && `Duração: ${post.duration}`].filter(Boolean).join(" · ")}
      </p>
      {post.trigger && <p className="mt-1 text-[12.5px] text-gray-600"><b>Gatilho:</b> {post.trigger}</p>}

      {post.no_script && <p className="mt-3 rounded-xl bg-gray-050 px-3 py-2 text-[13px] text-gray-700">Sem roteiro: conteúdo de acervo.</p>}

      {post.script_blocks.length > 0 && (
        <ol className="mt-3 space-y-2.5">
          {post.script_blocks.map((b, i) => (
            <li key={i} className="rounded-xl bg-gray-050 px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
                {b.label}
                {b.timing && <span className="ml-1.5 font-semibold normal-case tracking-normal text-gray-500">({b.timing})</span>}
              </p>
              <RoteiroText text={b.text || "—"} className="mt-0.5" />
            </li>
          ))}
        </ol>
      )}

      {[["Gravação", post.recording_notes], ["Legenda sugerida", post.caption], ["CTA", post.cta]].map(
        ([label, value]) =>
          value && (
            <div key={label} className="mt-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
              <RoteiroText text={value} />
            </div>
          )
      )}
    </article>
  );
}

/** Visão do dia: posts com o roteiro completo (para ler e gravar) e os Stories de cada perfil. */
export function DayView({
  cursor, posts, stories, account, onEditPost, onNewPost, onStoriesChanged,
}: {
  cursor: Date;
  posts: ContentPlanPost[];
  stories: ContentPlanStory[];
  account: PlanAccount | "";
  onEditPost: (p: ContentPlanPost) => void;
  onNewPost: (date: string) => void;
  onStoriesChanged: () => void;
}) {
  const key = toKey(cursor);
  const list = posts.filter((p) => p.publish_date === key);
  const accounts: PlanAccount[] = account ? [account] : ["franchising", "roberson"];
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-3">
        {list.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Nenhum post neste dia" description="Planeje um post ou use só os Stories." actionLabel="Novo post" onAction={() => onNewPost(key)} />
        ) : (
          <>
            {list.map((p) => <PostReader key={p.id} post={p} onEdit={() => onEditPost(p)} />)}
            <Button size="sm" variant="secondary" onClick={() => onNewPost(key)} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Outro post neste dia</Button>
          </>
        )}
      </div>
      <aside className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-[var(--shadow-sm)]">
        {accounts.map((a) => (
          <StoriesEditor key={a} account={a} date={key} stories={stories} onChange={onStoriesChanged} />
        ))}
      </aside>
    </div>
  );
}
