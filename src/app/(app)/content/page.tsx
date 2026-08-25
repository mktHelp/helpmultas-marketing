"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { listTasks } from "@/lib/services/tasks";
import type { ContentType, TaskWithRelations } from "@/types/database";
import { FileText } from "lucide-react";

const CONTENT_LABELS: Record<ContentType, string> = {
  reels: "Reels", stories: "Stories", feed: "Feed", carrossel: "Carrossel",
  youtube: "YouTube", blog: "Blog", email: "E-mail", whatsapp: "WhatsApp",
  anuncio: "Anúncio", landing_page: "Landing Page",
};

export default function ContentPage() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [contentType, setContentType] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    const all = await listTasks(supabase, {});
    setTasks(all.filter((t) => t.content_type));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = contentType ? tasks.filter((t) => t.content_type === contentType) : tasks;
  const counts = Object.keys(CONTENT_LABELS).map((key) => ({
    key, label: CONTENT_LABELS[key as ContentType], count: tasks.filter((t) => t.content_type === key).length,
  })).filter((c) => c.count > 0);

  return (
    <div>
      <PageHeader
        title="Conteúdos"
        description="Reels, Stories, Blog, E-mail e demais formatos em produção."
        action={<Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Novo conteúdo</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setContentType("")}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${!contentType ? "bg-blue-900 text-white" : "bg-gray-100 text-gray-700"}`}
        >
          Todos ({tasks.length})
        </button>
        {counts.map((c) => (
          <button
            key={c.key}
            onClick={() => setContentType(c.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${contentType === c.key ? "bg-blue-900 text-white" : "bg-gray-100 text-gray-700"}`}
          >
            {c.label} ({c.count})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhum conteúdo encontrado" actionLabel="Criar conteúdo" onAction={() => setCreateOpen(true)} />
      ) : (
        <KanbanBoard tasks={filtered} onRefresh={load} />
      )}

      <CreateTaskModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
    </div>
  );
}
