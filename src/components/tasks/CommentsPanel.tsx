"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { addComment } from "@/lib/services/tasks";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/utils";
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
  const supabase = createClient();

  async function send() {
    if (!content.trim() || !profile) return;
    setSending(true);
    try {
      const comment = await addComment(supabase, taskId, profile.id, content.trim());
      onChange([...comments, comment]);
      setContent("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      {comments.map((c) => (
        <div key={c.id} className="flex gap-3">
          <UserAvatar name={c.author?.full_name || "?"} avatarUrl={c.author?.avatar_url} size="sm" />
          <div className="flex-1 rounded-xl bg-gray-050 px-3.5 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-blue-900">{c.author?.full_name}</span>
              <span className="text-[11px] text-gray-400">{formatDateTime(c.created_at)}</span>
            </div>
            <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
          </div>
        </div>
      ))}
      {comments.length === 0 && <p className="text-sm text-gray-400">Nenhum comentário ainda.</p>}

      <div className="flex gap-2">
        <Textarea
          rows={2}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva um comentário..."
        />
        <Button onClick={send} disabled={sending || !content.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
