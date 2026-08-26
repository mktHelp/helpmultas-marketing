"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-runs `onChange` whenever a row changes in any of `tables`, so lists
 * stay live across users without needing a manual refresh (F5). Uses
 * Supabase Realtime's Postgres Changes, which requires the table to be
 * added to the `supabase_realtime` publication (see migration 0011).
 *
 * `onChange` is read from a ref so the subscription is created once per
 * mount regardless of how often the caller's function identity changes.
 *
 * `filters` optionally scopes a table's subscription with a Postgres
 * Changes filter string (e.g. `task_id=eq.<id>`), so e.g. a task detail
 * page only reacts to changes on *that* task's comments, not everyone's.
 */
export function useRealtimeChanges(
  tables: string[],
  onChange: () => void,
  options: { debounceMs?: number; filters?: Record<string, string> } = {}
) {
  const { debounceMs = 400, filters } = options;
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const tablesKey = tables.join(",");
  const filtersKey = filters ? JSON.stringify(filters) : "";

  useEffect(() => {
    if (!tablesKey) return;
    const supabase = createClient();
    let timeout: ReturnType<typeof setTimeout> | null = null;

    function trigger() {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => onChangeRef.current(), debounceMs);
    }

    let channel = supabase.channel(`realtime:${tablesKey}:${filtersKey}:${Math.random().toString(36).slice(2)}`);
    tablesKey.split(",").forEach((table) => {
      const filter = filters?.[table];
      channel = channel.on(
        "postgres_changes" as never,
        filter ? { event: "*", schema: "public", table, filter } : { event: "*", schema: "public", table },
        trigger
      );
    });
    channel.subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablesKey, filtersKey, debounceMs]);
}
