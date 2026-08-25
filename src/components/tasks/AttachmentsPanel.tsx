"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Paperclip, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { deleteAttachment, getAttachmentUrl, uploadAttachment } from "@/lib/services/tasks";
import { useAuth } from "@/lib/auth-context";
import type { TaskAttachment } from "@/types/database";

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentsPanel({
  taskId,
  attachments,
  onChange,
}: {
  taskId: string;
  attachments: TaskAttachment[];
  onChange: (attachments: TaskAttachment[]) => void;
}) {
  const { profile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    try {
      const attachment = await uploadAttachment(supabase, taskId, profile.id, file);
      onChange([...attachments, attachment]);
      toast.success("Arquivo anexado");
    } catch {
      toast.error("Erro ao anexar arquivo");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDownload(a: TaskAttachment) {
    const url = await getAttachmentUrl(supabase, a.file_path);
    window.open(url, "_blank");
  }

  async function handleDelete(a: TaskAttachment) {
    await deleteAttachment(supabase, a.id, a.file_path);
    onChange(attachments.filter((x) => x.id !== a.id));
  }

  return (
    <div className="space-y-2">
      {attachments.map((a) => (
        <div key={a.id} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2">
          <Paperclip className="h-4 w-4 shrink-0 text-gray-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-blue-900">{a.file_name}</p>
            <p className="text-xs text-gray-400">{formatSize(a.file_size)}</p>
          </div>
          <button onClick={() => handleDownload(a)} className="text-gray-400 hover:text-blue-900">
            <Download className="h-4 w-4" />
          </button>
          <button onClick={() => handleDelete(a)} className="text-gray-400 hover:text-[color:var(--color-danger)]">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {attachments.length === 0 && <p className="text-sm text-gray-400">Nenhum anexo.</p>}

      <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} />
      <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading} className="gap-1.5">
        <Paperclip className="h-3.5 w-3.5" /> {uploading ? "Enviando..." : "Anexar arquivo"}
      </Button>
    </div>
  );
}
