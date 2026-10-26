"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, NotebookText, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { savePlanMonth } from "@/lib/services/contentPlan";
import { ACCOUNT_LABEL, FORMAT_LABEL, MONTH_NAMES, monthKey } from "@/lib/contentPlan";
import type { ContentPlanMonth, ContentPlanPost, PlanAccount, PlanFormat } from "@/types/database";

function autoSummary(posts: ContentPlanPost[]) {
  if (!posts.length) return "Nenhum post planejado neste mês.";
  const parts = (["reels", "carrossel", "feed"] as PlanFormat[])
    .map((f) => ({ f, n: posts.filter((p) => p.format === f).length }))
    .filter((x) => x.n)
    .map((x) => `${x.n} ${FORMAT_LABEL[x.f]}`);
  const conv = posts.filter((p) => p.funnel === "fundo").length;
  const pinned = posts.filter((p) => p.pinned_slot).length;
  return [
    `${posts.length} ${posts.length === 1 ? "post" : "posts"} (${parts.join(", ")})`,
    conv ? `${conv} de conversão direta` : null,
    pinned ? `${pinned} ${pinned === 1 ? "fixado" : "fixados"} no perfil` : null,
  ].filter(Boolean).join(" · ");
}

function AccountBriefing({
  account, month, posts, row, onSaved,
}: {
  account: PlanAccount;
  month: string;
  posts: ContentPlanPost[];
  row?: ContentPlanMonth;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState(row?.summary ?? "");
  const [rules, setRules] = useState(row?.story_rules ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSummary(row?.summary ?? "");
    setRules(row?.story_rules ?? "");
  }, [row?.summary, row?.story_rules]);

  async function save() {
    setSaving(true);
    try {
      await savePlanMonth(supabase, { account, month, summary: summary.trim() || null, story_rules: rules.trim() || null });
      setEditing(false);
      onSaved();
    } catch {
      toast.error("Não foi possível salvar o resumo do mês.");
    } finally {
      setSaving(false);
    }
  }

  const ruleLines = (row?.story_rules ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

  return (
    <div className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{ACCOUNT_LABEL[account]}</p>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} aria-label="Editar resumo do mês" className="ml-auto rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-900">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className="mt-1 text-[12.5px] font-semibold text-blue-900">{autoSummary(posts)}</p>

      {editing ? (
        <div className="mt-2 space-y-2">
          <Textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Resumo do mês: dias fixos de post, posts de conversão, fixados…" />
          <Textarea rows={7} value={rules} onChange={(e) => setRules(e.target.value)} placeholder="Regras práticas dos Stories (uma por linha)" />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving} className="gap-1"><Check className="h-3.5 w-3.5" /> Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <>
          {row?.summary && <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-600">{row.summary}</p>}
          {ruleLines.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[12px] font-bold text-blue-700">Regras dos Stories ({ruleLines.length})</summary>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[12.5px] leading-snug text-gray-600">
                {ruleLines.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </details>
          )}
          {!row?.summary && ruleLines.length === 0 && (
            <button type="button" onClick={() => setEditing(true)} className="mt-1 text-[12px] font-semibold text-blue-700 hover:underline">
              Adicionar resumo e regras do mês
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** Resumo do mês por perfil: números calculados dos posts + texto livre e regras dos Stories (editáveis). */
export function MonthBriefing({
  cursor, posts, months, account, onSaved,
}: {
  cursor: Date;
  posts: ContentPlanPost[];
  months: ContentPlanMonth[];
  account: PlanAccount | "";
  onSaved: () => void;
}) {
  const key = monthKey(cursor);
  const accounts: PlanAccount[] = account ? [account] : ["franchising", "roberson"];
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[var(--shadow-sm)]">
      <div className="mb-3 flex items-center gap-2">
        <NotebookText className="h-4 w-4 text-blue-700" />
        <h3 className="font-display text-[13px] font-bold text-blue-900">Resumo de {MONTH_NAMES[cursor.getMonth()].toLowerCase()}</h3>
      </div>
      <div className="space-y-3">
        {accounts.map((a) => (
          <AccountBriefing
            key={a}
            account={a}
            month={key}
            posts={posts.filter((p) => p.account === a)}
            row={months.find((m) => m.account === a && m.month === key)}
            onSaved={onSaved}
          />
        ))}
      </div>
    </section>
  );
}
