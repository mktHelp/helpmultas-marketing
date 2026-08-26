"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";

/**
 * Drop into a Server Component page to keep it live: re-runs the server
 * render (router.refresh()) whenever a row changes in `tables`, without a
 * full page reload. Renders nothing.
 */
export function RealtimeRefresher({ tables }: { tables: string[] }) {
  const router = useRouter();
  const onChange = useCallback(() => router.refresh(), [router]);
  useRealtimeChanges(tables, onChange);
  return null;
}
