"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { CalendarDays, ExternalLink, Link2, Pencil, Plus, Trash2, Video } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/Dialog";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  createMeetingLink, deleteMeetingLink, drivePreviewUrl, listMeetingLinks, updateMeetingLink,
  type MeetingLinkInput,
} from "@/lib/services/expansionPlaybook";
import { cn } from "@/lib/utils";
import type { ExpansionMeetingLink } from "@/types/database";

const EMPTY: MeetingLinkInput = { title: "", url: "", meeting_date: null, notes: null };

function dateLabel(d: string | null) {
  return d ? format(parseISO(d), "dd/MM/yyyy") : "";
}

export function ExpansionDriveMeetings() {
  const supabase = useMemo(() => createClient(), []);
  const { profile: me } = useAuth();
  const [links, setLinks] = useState<ExpansionMeetingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ editing: ExpansionMeetingLink | null } | null>(null);
  const [form, setForm] = useState<MeetingLinkInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ExpansionMeetingLink | null>(null);

  useEffect(() => {
    listMeetingLinks(supabase)
      .then((l) => {
        setLinks(l);
        setSelectedId(l[0]?.id ?? null);
      })
      .catch(() => toast.error("Não foi possível carregar as reuniões"))
      .finally(() => setLoading(false));
  }, [supabase]);

  const selected = links.find((l) => l.id === selectedId) ?? null;
  const preview = selected ? drivePreviewUrl(selected.url) : null;

  function openDialog(editing: ExpansionMeetingLink | null) {
    setForm(editing ? { title: editing.title, url: editing.url, meeting_date: editing.meeting_date, notes: editing.notes } : EMPTY);
    setDialog({ editing });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const url = form.url.trim();
    if (!form.title.trim() || !url) return;
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Cole o link completo, começando com https://");
      return;
    }
    const input = { ...form, title: form.title.trim(), url, notes: form.notes?.trim() || null };
    setSaving(true);
    try {
      if (dialog?.editing) {
        const saved = await updateMeetingLink(supabase, dialog.editing.id, input);
        setLinks((prev) => prev.map((l) => (l.id === saved.id ? saved : l)));
        toast.success("Reunião atualizada");
      } else {
        const saved = await createMeetingLink(supabase, me?.id || "", input);
        setLinks((prev) => [saved, ...prev]);
        setSelectedId(saved.id);
        toast.success("Reunião adicionada");
      }
      setDialog(null);
    } catch {
      toast.error("Não foi possível salvar a reunião");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(l: ExpansionMeetingLink) {
    try {
      await deleteMeetingLink(supabase, l.id);
      const rest = links.filter((x) => x.id !== l.id);
      setLinks(rest);
      if (selectedId === l.id) setSelectedId(rest[0]?.id ?? null);
      toast.success("Reunião removida");
    } catch {
      toast.error("Erro ao remover a reunião");
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="flex max-h-[calc(100dvh-220px)] min-h-[320px] flex-col p-0">
        <div className="flex items-center gap-2 border-b border-gray-100 p-3">
          <p className="font-display text-sm font-bold text-blue-900">Reuniões gravadas</p>
          <span className="rounded-full bg-gray-100 px-2 text-[11px] font-bold text-gray-600">{links.length}</span>
          <Button size="sm" onClick={() => openDialog(null)} className="ml-auto gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2.5">
          {loading ? (
            [0, 1, 2].map((i) => <div key={i} className="ast-skeleton h-16 rounded-xl" />)
          ) : links.length === 0 ? (
            <EmptyState icon={Video} title="Nenhuma reunião ainda" description="Cole o link de uma gravação do Drive." actionLabel="Adicionar link" onAction={() => openDialog(null)} />
          ) : (
            links.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelectedId(l.id)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-all active:scale-[0.99]",
                  l.id === selectedId ? "border-yellow-400 bg-yellow-050" : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                <span className="block truncate text-sm font-bold text-blue-900">{l.title}</span>
                {l.meeting_date && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500">
                    <CalendarDays className="h-3 w-3" /> {dateLabel(l.meeting_date)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </Card>

      <Card className="flex min-h-[420px] flex-col p-0">
        {selected ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-bold text-blue-900">{selected.title}</p>
                {selected.notes && <p className="line-clamp-2 text-xs text-gray-500">{selected.notes}</p>}
              </div>
              <button type="button" onClick={() => openDialog(selected)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-900" aria-label="Editar" title="Editar">
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setConfirmDelete(selected)} className="rounded-full p-2 text-gray-400 hover:bg-[color:var(--color-danger-bg)] hover:text-[color:var(--color-danger)]" aria-label="Remover" title="Remover">
                <Trash2 className="h-4 w-4" />
              </button>
              <a href={selected.url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir no Drive
                </Button>
              </a>
            </div>
            {preview ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <iframe
                  key={preview}
                  src={preview}
                  title={selected.title}
                  allow="autoplay; fullscreen"
                  allowFullScreen
                  className="h-[calc(100dvh-340px)] min-h-[360px] w-full rounded-b-2xl border-0 bg-gray-050"
                />
                <p className="px-3 py-2 text-[11px] text-gray-400">Se a prévia não carregar (permissão do Drive ou login), use o botão &ldquo;Abrir no Drive&rdquo;.</p>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                <Link2 className="h-8 w-8 text-gray-300" />
                <p className="text-sm font-semibold text-gray-600">Este link não tem prévia dentro do app.</p>
                <p className="text-xs text-gray-400">Use o botão &ldquo;Abrir no Drive&rdquo; para ver a reunião.</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-gray-400">Selecione uma reunião para ver a prévia.</div>
        )}
      </Card>

      <Dialog open={!!dialog} onClose={() => setDialog(null)} size="md">
        <DialogHeader title={dialog?.editing ? "Editar reunião" : "Nova reunião"} subtitle="Link de uma gravação, documento ou pasta do Drive." onClose={() => setDialog(null)} />
        <form onSubmit={submit}>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="mt-title">Título</Label>
              <Input id="mt-title" autoFocus value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: 1ª reunião — João Silva" style={{ fontSize: 16 }} />
            </div>
            <div>
              <Label htmlFor="mt-url">Link do Drive</Label>
              <Input id="mt-url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://drive.google.com/file/d/…" style={{ fontSize: 16 }} />
            </div>
            <div>
              <Label htmlFor="mt-date">Data da reunião</Label>
              <Input id="mt-date" type="date" value={form.meeting_date ?? ""} onChange={(e) => setForm({ ...form, meeting_date: e.target.value || null })} style={{ fontSize: 16 }} />
            </div>
            <div>
              <Label htmlFor="mt-notes">Observações</Label>
              <Textarea id="mt-notes" rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ fontSize: 16 }} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button type="submit" disabled={!form.title.trim() || !form.url.trim() || saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        title="Remover reunião"
        description="Só o link sai daqui; o arquivo no Drive não é apagado."
        confirmLabel="Remover"
        danger
      />
    </div>
  );
}
