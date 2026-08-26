"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

const COLORS = ["#243746", "#4a6a80", "#fcbf00", "#e0a900", "#375367", "#2f8f5b", "#c23b3b", "#7c8e98", "#8e44ad", "#16a085"];

function colorFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

interface RemoteCursor {
  x: number; // 0-1, fraction of viewport width
  y: number; // 0-1, fraction of viewport height
  name: string;
  color: string;
  updatedAt: number;
}

const STALE_MS = 8000;
const SEND_INTERVAL_MS = 45;

// Shows every other user's mouse position live (Supabase Realtime broadcast -
// no database writes, just WebSocket messages). Scoped per-page: only people
// currently on the same route see each other's cursors, which matches how
// collaboration actually happens (e.g. everyone on the Board together).
export function LiveCursors() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({});

  useEffect(() => {
    if (!profile) return;

    const supabase = createClient();
    const channel = supabase.channel(`cursors:${pathname}`, {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "cursor" }, ({ payload }) => {
      setCursors((prev) => ({
        ...prev,
        [payload.id]: { x: payload.x, y: payload.y, name: payload.name, color: payload.color, updatedAt: Date.now() },
      }));
    });

    channel.on("broadcast", { event: "leave" }, ({ payload }) => {
      setCursors((prev) => {
        if (!(payload.id in prev)) return prev;
        const next = { ...prev };
        delete next[payload.id];
        return next;
      });
    });

    let ready = false;
    channel.subscribe((status) => {
      ready = status === "SUBSCRIBED";
    });

    let lastSent = 0;
    function onPointerMove(e: PointerEvent) {
      if (!ready) return;
      const now = Date.now();
      if (now - lastSent < SEND_INTERVAL_MS) return;
      lastSent = now;
      channel.send({
        type: "broadcast",
        event: "cursor",
        payload: {
          id: profile!.id,
          x: e.clientX / window.innerWidth,
          y: e.clientY / window.innerHeight,
          name: profile!.full_name.split(" ")[0],
          color: colorFor(profile!.id),
        },
      });
    }
    window.addEventListener("pointermove", onPointerMove);

    const pruneInterval = setInterval(() => {
      setCursors((prev) => {
        const now = Date.now();
        const next: typeof prev = {};
        let changed = false;
        for (const [id, c] of Object.entries(prev)) {
          if (now - c.updatedAt < STALE_MS) next[id] = c;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 3000);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      clearInterval(pruneInterval);
      if (ready) channel.send({ type: "broadcast", event: "leave", payload: { id: profile!.id } });
      supabase.removeChannel(channel);
      setCursors({});
    };
  }, [pathname, profile]);

  if (!profile || Object.keys(cursors).length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      {Object.entries(cursors).map(([id, c]) => (
        <div
          key={id}
          className="absolute transition-[left,top] duration-100 ease-linear"
          style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}>
            <path d="M2 2L18 9L10 11L7 18L2 2Z" fill={c.color} stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          <span
            className="ml-3 -mt-1 inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-bold text-white"
            style={{ backgroundColor: c.color }}
          >
            {c.name}
          </span>
        </div>
      ))}
    </div>
  );
}
