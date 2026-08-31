"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { listNotifications, markAllAsRead, markAsRead, unreadCount } from "@/lib/services/notifications";
import type { Notification } from "@/types/database";
import { cn, formatDateTime } from "@/lib/utils";

export function NotificationDropdown() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  async function load() {
    if (!profile) return;
    const [list, c] = await Promise.all([
      listNotifications(supabase, profile.id),
      unreadCount(supabase, profile.id),
    ]);
    setItems(list);
    setCount(c);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-gray-700 hover:bg-gray-100"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[color:var(--color-danger)] px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-gray-200 bg-white shadow-[var(--shadow-lg)]">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="font-display text-sm font-bold text-blue-900">Notificações</p>
            {count > 0 && (
              <button
                onClick={async () => {
                  if (profile) await markAllAsRead(supabase, profile.id);
                  load();
                }}
                className="text-xs font-semibold text-blue-800 hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-500">Nenhuma notificação</p>}
            {items.map((n) => (
              <Link
                key={n.id}
                href={
                  n.task_id
                    ? `/tasks/${n.task_id}`
                    : n.type === "birthday" || n.type === "work_anniversary"
                      ? "/birthdays"
                      : "#"
                }
                onClick={async () => {
                  await markAsRead(supabase, n.id);
                  setOpen(false);
                  load();
                }}
                className={cn(
                  "block border-b border-gray-50 px-4 py-3 text-sm hover:bg-gray-050",
                  !n.read_at && "bg-yellow-050"
                )}
              >
                <p className="font-semibold text-blue-900">{n.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">{n.message}</p>
                <p className="mt-1 text-[11px] text-gray-400">{formatDateTime(n.created_at)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
