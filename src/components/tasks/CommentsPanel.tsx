"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Send } from "lucide-react";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { createClient } from "@/lib/supabase/client";
import { addComment } from "@/lib/services/tasks";
import { useAuth } from "@/lib/auth-context";
import { cn, formatDateTime } from "@/lib/utils";
import type { TaskComment } from "@/types/database";

export function CommentsPanel({
  taskId,
  comments,
  onChange,
}: {
  taskId: string;
  comments: TaskComment[];
  onChange: (comments: TaskComment[]) => void;
}) {
  const { profile } = useAuth();
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // novos comentários (meus ou de colegas via realtime) rolam até o fim da conversa
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [comments.length]);

  async function send() {
    const text = content.trim();
    if (!text || !profile || sending) return;
    setSending(true);
    try {
      const comment = await addComment(supabase, taskId, profile.id, text);
      onChange([...comments, comment]);
      setContent("");
    } catch {
      toast.error("Não foi possível enviar o comentário");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {comments.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-gray-200 py-10 text-center">
          <MessageSquare className="h-7 w-7 text-gray-300" />
          <p className="text-sm text-gray-400">Nenhum comentário ainda. Comece a conversa!</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {comments.map((c, i) => {
            const mine = c.user_id === profile?.id || c.author?.id === profile?.id;
            return (
              <li
                key={c.id}
                style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                className={cn("kb-card-in flex items-end gap-2.5", mine && "flex-row-reverse")}
              >
                <UserAvatar name={c.author?.full_name || "?"} avatarUrl={c.author?.avatar_url} size="sm" />
                <div className={cn("min-w-0 max-w-[85%] rounded-2xl px-3.5 py-2.5", mine ? "rounded-br-md bg-yellow-100" : "rounded-bl-md bg-gray-050")}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-bold text-blue-900">{mine ? "Você" : c.author?.full_name}</span>
                    <span className="shrink-0 text-[10px] font-semibold text-gray-400">{formatDateTime(c.created_at)}</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-gray-800">{c.content}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div ref={endRef} />

      <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-white p-2 transition-all focus-within:border-blue-900 focus-within:shadow-[var(--shadow-focus)]">
        <textarea
          rows={2}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Escreva um comentário… (Ctrl+Enter envia)"
          aria-label="Novo comentário"
          className="min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-blue-900 outline-none placeholder:text-gray-400"
          style={{ fontSize: 16 }}
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !content.trim()}
          aria-label="Enviar comentário"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-500 text-blue-900 shadow-sm transition-all hover:bg-yellow-600 active:scale-90 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
