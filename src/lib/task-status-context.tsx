"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { listTaskStatuses } from "@/lib/services/reference";
import type { TaskStatusRow } from "@/types/database";

interface TaskStatusContextValue {
  statuses: TaskStatusRow[];
  activeStatuses: TaskStatusRow[];
  byKey: Record<string, TaskStatusRow>;
  defaultStatusKey: string;
  refresh: () => Promise<void>;
}

const TaskStatusContext = createContext<TaskStatusContextValue>({
  statuses: [],
  activeStatuses: [],
  byKey: {},
  defaultStatusKey: "backlog",
  refresh: async () => {},
});

export function TaskStatusProvider({
  initialStatuses,
  children,
}: {
  initialStatuses: TaskStatusRow[];
  children: React.ReactNode;
}) {
  const [statuses, setStatuses] = useState<TaskStatusRow[]>(initialStatuses);
  const supabase = useMemo(() => createClient(), []);

  const refresh = useCallback(async () => {
    const data = await listTaskStatuses(supabase);
    setStatuses(data);
  }, [supabase]);

  const value = useMemo<TaskStatusContextValue>(() => {
    const byKey = Object.fromEntries(statuses.map((s) => [s.key, s]));
    return {
      statuses,
      activeStatuses: statuses.filter((s) => s.is_active),
      byKey,
      defaultStatusKey: statuses.find((s) => s.is_default)?.key || statuses[0]?.key || "backlog",
      refresh,
    };
  }, [statuses, refresh]);

  return <TaskStatusContext.Provider value={value}>{children}</TaskStatusContext.Provider>;
}

export function useTaskStatuses() {
  return useContext(TaskStatusContext);
}
