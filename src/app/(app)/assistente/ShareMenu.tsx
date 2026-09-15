"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, UserPlus, X } from "lucide-react";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { createClient } from "@/lib/supabase/client";
import { listProfiles } from "@/lib/services/profiles";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

interface Member {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export function ShareMenu({
  conversationId,
  ownerId,
  onClose,
  onMembersChange,
}: {
  conversationId: string;
  ownerId: string;
  onClose: () => void;
  onMembersChange: (members: Member[]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();
        const [allProfiles, membersRes] = await Promise.all([
          listProfiles(supabase),
          fetch(`/api/assistente/conversations/${conversationId}/members`).then((r) => r.json()),
        ]);
        if (cancelled) return;
        setProfiles(allProfiles.filter((p) => p.id !== ownerId));
        setMembers(membersRes.members || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [conversationId, ownerId]);

  async function addMember(userId: string) {
    setPendingId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/assistente/conversations/${conversationId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Não foi possível compartilhar com essa pessoa.");
        return;
      }
      const added = profiles.find((p) => p.id === userId);
      if (added) {
        const next = [...members, { id: added.id, full_name: added.full_name, avatar_url: added.avatar_url }];
        setMembers(next);
        onMembersChange(next);
      }
    } catch {
      setError("Não foi possível compartilhar com essa pessoa.");
    } finally {
      setPendingId(null);
    }
  }

  async function removeMember(userId: string) {
    setPendingId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/assistente/conversations/${conversationId}/members/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Não foi possível remover o acesso dessa pessoa.");
        return;
      }
      const next = members.filter((m) => m.id !== userId);
      setMembers(next);
      onMembersChange(next);
    } catch {
      setError("Não foi possível remover o acesso dessa pessoa.");
    } finally {
      setPendingId(null);
    }
  }

  const memberIds = new Set(members.map((m) => m.id));

  return (
    <div
      ref={ref}
      className="absolute left-0 right-0 top-full z-30 mt-1 rounded-2xl border border-gray-200 bg-white p-2 shadow-[var(--shadow-lg)]"
    >
      <p className="px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-400">Compartilhar conversa</p>
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto">
          {profiles.map((p) => {
            const active = memberIds.has(p.id);
            const busy = pendingId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={busy}
                onClick={() => (active ? removeMember(p.id) : addMember(p.id))}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gray-050",
                  active && "bg-yellow-050"
                )}
              >
                <UserAvatar name={p.full_name} avatarUrl={p.avatar_url} size="xs" />
                <span className="flex-1 truncate text-blue-900">{p.full_name}</span>
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-gray-400" />
                ) : active ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-yellow-600" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                )}
              </button>
            );
          })}
          {profiles.length === 0 && <p className="px-2 py-2 text-xs text-gray-400">Nenhum outro membro da equipe.</p>}
        </div>
      )}
      {error && <p className="px-2 py-1.5 text-xs font-semibold text-[color:var(--color-danger)]">{error}</p>}
      <button
        type="button"
        onClick={onClose}
        className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-050"
      >
        <X className="h-3 w-3" />
        Fechar
      </button>
    </div>
  );
}
