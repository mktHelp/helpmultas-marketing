"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { listTasks } from "@/lib/services/tasks";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { cn } from "@/lib/utils";
import type { TaskWithRelations } from "@/types/database";

export default function CalendarPage() {
  const supabase = createClient();
  const [month, setMonth] = useState(new Date());
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);

  const load = useCallback(() => {
    listTasks(supabase, {}).then(setTasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeChanges(["tasks", "task_assignees"], load);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const tasksByDay = (day: Date) =>
    tasks.filter((t) => t.due_date && isSameDay(parseISO(t.due_date), day));

  return (
    <div>
      <PageHeader
        title="Calendário"
        description="Prazos, gravações e publicações do Marketing."
        action={
          <div className="flex items-center gap-2">
            <Button size="icon" variant="secondary" onClick={() => setMonth(subMonths(month, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-display text-sm font-bold text-blue-900 capitalize w-32 text-center">
              {format(month, "MMMM yyyy")}
            </span>
            <Button size="icon" variant="secondary" onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="bg-blue-900 py-2 text-center text-xs font-bold text-white">{d}</div>
        ))}
        {days.map((day) => {
          const dayTasks = tasksByDay(day);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[110px] bg-white p-2",
                !isSameMonth(day, month) && "bg-gray-050 text-gray-300"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                  isToday(day) ? "bg-yellow-500 text-blue-900" : "text-gray-500"
                )}
              >
                {format(day, "d")}
              </span>
              <div className="mt-1 space-y-1">
                {dayTasks.slice(0, 3).map((t) => (
                  <Link
                    key={t.id}
                    href={`/tasks/${t.id}`}
                    className="block truncate rounded-md bg-blue-050 px-1.5 py-0.5 text-[11px] font-semibold text-blue-900 hover:bg-blue-100"
                  >
                    {t.title}
                  </Link>
                ))}
                {dayTasks.length > 3 && (
                  <p className="text-[10px] font-semibold text-gray-400">+{dayTasks.length - 3} mais</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
