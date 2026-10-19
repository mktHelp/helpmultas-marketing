"use client";

import { useMemo } from "react";
import { MessageCircle, Plus } from "lucide-react";
import { PostChip } from "./planParts";
import { MonthBriefing } from "./MonthBriefing";
import { PendingPanel } from "./PendingPanel";
import { WEEKDAY_SHORT, addDays, startOfWeek, toKey, todayKey } from "@/lib/contentPlan";
import { cn } from "@/lib/utils";
import type { ContentPlanMonth, ContentPlanPost, ContentPlanStory, PlanAccount } from "@/types/database";

/** Visão do mês: grade de calendário (segunda a domingo) + resumo do mês e pendências antes de gravar. */
export function MonthView({
  cursor, posts, stories, months, account, onOpenPost, onNewPost, onOpenDay, onTogglePending, onMonthSaved,
}: {
  cursor: Date;
  posts: ContentPlanPost[];
  stories: ContentPlanStory[];
  months: ContentPlanMonth[];
  account: PlanAccount | "";
  onOpenPost: (p: ContentPlanPost) => void;
  onNewPost: (date: string) => void;
  onOpenDay: (date: string) => void;
  onTogglePending: (post: ContentPlanPost, index: number) => void;
  onMonthSaved: () => void;
}) {
  const month = cursor.getMonth();
  const today = todayKey();
  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), month, 1);
    const last = new Date(cursor.getFullYear(), month + 1, 0);
    const start = startOfWeek(first);
    const end = addDays(startOfWeek(last), 6);
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [cursor, month]);

  const byDay = useMemo(() => {
    const map = new Map<string, ContentPlanPost[]>();
    for (const p of posts) map.set(p.publish_date, [...(map.get(p.publish_date) ?? []), p]);
    return map;
  }, [posts]);
  const storiesByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of stories) map.set(s.story_date, (map.get(s.story_date) ?? 0) + 1);
    return map;
  }, [stories]);

  const inMonth = posts.filter((p) => new Date(p.publish_date + "T00:00:00").getMonth() === month);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-[var(--shadow-sm)]">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-050">
            {WEEKDAY_SHORT.map((d) => (
              <div key={d} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-gray-500">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const key = toKey(d);
              const list = byDay.get(key) ?? [];
              const outside = d.getMonth() !== month;
              const nStories = storiesByDay.get(key) ?? 0;
              return (
                <div
                  key={key}
                  className={cn("group relative min-h-[132px] border-b border-r border-gray-100 p-1.5", outside && "bg-gray-050/60")}
                >
                  <div className="mb-1 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenDay(key)}
                      className={cn(
                        "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] font-bold hover:bg-gray-100",
                        key === today ? "bg-blue-900 text-white hover:bg-blue-900" : outside ? "text-gray-400" : "text-blue-900"
                      )}
                      title="Abrir o dia"
                    >
                      {d.getDate()}
                    </button>
                    {nStories > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700" title={`${nStories} Stories planejados`}>
                        <MessageCircle className="h-3 w-3" /> {nStories}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onNewPost(key)}
                      aria-label={`Novo post em ${key}`}
                      className="ml-auto rounded-full p-1 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-blue-900 focus:opacity-100 group-hover:opacity-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {list.map((p) => (
                      <PostChip key={p.id} post={p} showAccount={!account} onClick={() => onOpenPost(p)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <MonthBriefing cursor={cursor} posts={inMonth} months={months} account={account} onSaved={onMonthSaved} />
        <PendingPanel posts={inMonth} onOpenPost={onOpenPost} onToggle={onTogglePending} />
      </aside>
    </div>
  );
}
