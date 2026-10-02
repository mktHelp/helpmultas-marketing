"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, File as FileIcon, FileImage, FileText, FileVideo, Loader2, Trash2, UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deleteAttachment, getAttachmentUrl, uploadAttachment } from "@/lib/services/tasks";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { TaskAttachment } from "@/types/database";

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function kindOf(a: TaskAttachment) {
  const type = a.file_type || "";
  const name = a.file_name.toLowerCase();
  if (type.startsWith("image/")) return { icon: FileImage, color: "#8b5cf6" };
  if (type.startsWith("video/")) return { icon: FileVideo, color: "#ec4899" };
  if (type.includes("pdf") || name.endsWith(".pdf")) return { icon: FileText, color: "#c23b3b" };
  if (/\.(docx?|txt|md|xlsx?|csv|pptx?)$/.test(name)) return { icon: FileText, color: "#3b82f6" };
  return { icon: FileIcon, color: "#7c8e98" };
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
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0 || !profile) return;
    setUploading(true);
    let current = attachments;
    try {
      for (const file of list) {
        const attachment = await uploadAttachment(supabase, taskId, profile.id, file);
        current = [...current, attachment];
        onChange(current);
      }
      toast.success(list.length === 1 ? "Arquivo anexado" : `${list.length} arquivos anexados`);
    } catch {
      toast.error("Erro ao anexar arquivo");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDownload(a: TaskAttachment) {
    try {
      const url = await getAttachmentUrl(supabase, a.file_path);
      window.open(url, "_blank");
    } catch {
      toast.error("Não foi possível abrir o arquivo");
    }
  }

  async function handleDelete(a: TaskAttachment) {
    try {
      await deleteAttachment(supabase, a.id, a.file_path);
      onChange(attachments.filter((x) => x.id !== a.id));
    } catch {
      toast.error("Não foi possível remover o arquivo");
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void uploadFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-all",
          dragging ? "scale-[1.01] border-yellow-500 bg-yellow-050" : "border-gray-200 bg-gray-050/60"
        )}
      >
        {uploading ? <Loader2 className="h-7 w-7 animate-spin text-blue-700" /> : <UploadCloud className={cn("h-7 w-7 transition-transform", dragging ? "-translate-y-1 text-yellow-600" : "text-gray-400")} />}
        <p className="text-sm text-gray-500">{uploading ? "Enviando…" : "Arraste arquivos aqui ou"}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-full bg-yellow-500 px-5 py-2.5 font-display text-sm font-semibold text-blue-900 shadow-sm transition-all hover:bg-yellow-600 active:scale-95 disabled:opacity-50"
        >
          Escolher arquivos
        </button>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && void uploadFiles(e.target.files)} />
      </div>

      {attachments.length === 0 ? (
        <p className="py-2 text-center text-sm text-gray-400">Nenhum anexo ainda.</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a, i) => {
            const { icon: Icon, color } = kindOf(a);
            return (
              <li
                key={a.id}
                style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                className="kb-card-in group flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-3 py-2.5 transition-all hover:border-gray-200 hover:shadow-[var(--shadow-sm)]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}1f`, color }}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-blue-900">{a.file_name}</p>
                  <p className="text-xs text-gray-400">{formatSize(a.file_size)}</p>
                </div>
                <button type="button" onClick={() => handleDownload(a)} aria-label={`Baixar ${a.file_name}`} className="rounded-full p-2 text-gray-400 transition-colors hover:bg-blue-050 hover:text-blue-900">
                  <Download className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => handleDelete(a)} aria-label={`Remover ${a.file_name}`} className="rounded-full p-2 text-gray-400 transition-colors hover:bg-[color:var(--color-danger-bg)] hover:text-[color:var(--color-danger)]">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
