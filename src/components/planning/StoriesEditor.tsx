"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { addPlanStories, deletePlanStory, updatePlanStory } from "@/lib/services/contentPlan";
import { ACCOUNT_LABEL, MOMENT_HINT, MOMENT_LABEL, MOMENT_ORDER } from "@/lib/contentPlan";
import { cn } from "@/lib/utils";
import type { ContentPlanStory, PlanAccount, PlanStoryMoment } from "@/types/database";

/** Stories do dia de um perfil: manhã, durante o dia e fim do dia (o modelo do cronograma), mais extras. */
export function StoriesEditor({
  account, date, stories, onChange,
}: {
  account: PlanAccount;
  date: string;
  stories: ContentPlanStory[];
  onChange: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const list = stories
    .filter((s) => s.account === account && s.story_date === date)
    .sort((a, b) => MOMENT_ORDER.indexOf(a.moment) - MOMENT_ORDER.indexOf(b.moment) || a.created_at.localeCompare(b.created_at));

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      onChange();
    } catch {
      toast.error("Não foi possível salvar os Stories.");
    } finally {
      setBusy(false);
    }
  }

  const useTemplate = () =>
    run(() => addPlanStories(supabase, (["manha", "durante", "fim"] as PlanStoryMoment[]).map((moment) => ({ account, story_date: date, moment }))));
  const add = (moment: PlanStoryMoment) => run(() => addPlanStories(supabase, [{ account, story_date: date, moment }]));

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-amber-600" />
        <h4 className="font-display text-[13px] font-bold text-blue-900">Stories · {ACCOUNT_LABEL[account]}</h4>
        {list.length > 0 && (
          <button
            type="button"
            onClick={() => add("extra")}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-bold text-blue-700 hover:bg-gray-100"
          >
            <Plus className="h-3 w-3" /> Story extra
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <button
          type="button"
          onClick={useTemplate}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-[12.5px] font-semibold text-blue-700 hover:border-blue-300 hover:bg-gray-050"
        >
          <Wand2 className="h-3.5 w-3.5" /> Usar modelo do dia (manhã, durante, fim)
        </button>
      ) : (
        <ul className="space-y-2">
          {list.map((s) => (
            <li key={s.id} className="rounded-xl border border-gray-200 bg-white p-2.5">
              <div className="mb-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={s.done}
                  onChange={(e) => run(() => updatePlanStory(supabase, s.id, { done: e.target.checked }))}
                  aria-label="Story publicado"
                  className="h-3.5 w-3.5 accent-[#e0a900]"
                />
                <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{MOMENT_LABEL[s.moment]}</span>
                <button
                  type="button"
                  onClick={() => run(() => deletePlanStory(supabase, s.id))}
                  aria-label="Remover Story"
                  className="ml-auto rounded-full p-1 text-gray-400 hover:bg-red-50 hover:text-[color:var(--color-danger)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <Textarea
                key={s.id + s.text}
                rows={2}
                defaultValue={s.text}
                placeholder={MOMENT_HINT[s.moment] || "O que mostrar neste Story"}
                onBlur={(e) => {
                  if (e.target.value !== s.text) void run(() => updatePlanStory(supabase, s.id, { text: e.target.value }));
                }}
                className={cn(s.done && "text-gray-500")}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
