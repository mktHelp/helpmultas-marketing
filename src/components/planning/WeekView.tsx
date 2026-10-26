"use client";

import { MessageCircle, Plus } from "lucide-react";
import { PostChip } from "./planParts";
import { addDays, pad, startOfWeek, toKey, todayKey, weekdayShort } from "@/lib/contentPlan";
import { cn } from "@/lib/utils";
import type { ContentPlanPost, ContentPlanStory, PlanAccount } from "@/types/database";

/** Visão da semana: uma coluna por dia (segunda a domingo) com os posts e quantos Stories estão planejados. */
export function WeekView({
  cursor, posts, stories, account, onOpenPost, onNewPost, onOpenDay,
}: {
  cursor: Date;
  posts: ContentPlanPost[];
  stories: ContentPlanStory[];
  account: PlanAccount | "";
  onOpenPost: (p: ContentPlanPost) => void;
  onNewPost: (date: string) => void;
  onOpenDay: (date: string) => void;
}) {
  const start = startOfWeek(cursor);
  const today = todayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[980px] grid-cols-7 gap-2.5">
        {days.map((d) => {
          const key = toKey(d);
          const list = posts.filter((p) => p.publish_date === key);
          const nStories = stories.filter((s) => s.story_date === key).length;
          return (
            <div
              key={key}
              className={cn(
                "flex min-h-[320px] flex-col rounded-2xl border bg-white p-2 shadow-[var(--shadow-sm)]",
                key === today ? "border-yellow-500" : "border-gray-200"
              )}
            >
              <button type="button" onClick={() => onOpenDay(key)} className="mb-2 flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-left hover:bg-gray-050">
                <span className={cn("flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[13px] font-bold", key === today ? "bg-blue-900 text-white" : "text-blue-900")}>
                  {pad(d.getDate())}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{weekdayShort(d)}</span>
                {nStories > 0 && (
                  <span className="ml-auto inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-amber-700">
                    <MessageCircle className="h-3 w-3" /> {nStories}
                  </span>
                )}
              </button>
              <div className="flex-1 space-y-1.5">
                {list.map((p) => (
                  <PostChip key={p.id} post={p} showAccount={!account} onClick={() => onOpenPost(p)} />
                ))}
              </div>
              <button
                type="button"
                onClick={() => onNewPost(key)}
                className="mt-2 inline-flex items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 py-1.5 text-[11.5px] font-semibold text-gray-500 hover:border-blue-300 hover:text-blue-900"
              >
                <Plus className="h-3 w-3" /> Post
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
