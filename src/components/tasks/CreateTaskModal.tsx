"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { AssigneesPicker } from "./AssigneesPicker";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { listAreas, listCategories, listTags, listTemplates } from "@/lib/services/reference";
import { listProjects, listCampaigns } from "@/lib/services/projects";
import { listProfiles } from "@/lib/services/profiles";
import { createTask } from "@/lib/services/tasks";
import { useTaskStatuses } from "@/lib/task-status-context";
import { dateInputToISO } from "@/lib/utils";
import type { Area, Campaign, Category, Profile, Project, Tag, TaskTemplate } from "@/types/database";

export function CreateTaskModal({
  open,
  onClose,
  onCreated,
  defaultStatus,
  defaultProjectId,
  defaultCampaignId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  defaultStatus?: string;
  defaultProjectId?: string;
  defaultCampaignId?: string;
}) {
  const { profile } = useAuth();
  const { activeStatuses, defaultStatusKey } = useTaskStatuses();
  const supabase = createClient();

  const [areas, setAreas] = useState<Area[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    project_id: defaultProjectId || "",
    campaign_id: defaultCampaignId || "",
    area_id: "",
    category_id: "",
    assigneeIds: [] as string[],
    priority: "media",
    status: defaultStatus || defaultStatusKey,
    due_date: "",
    template_id: "",
    tagIds: [] as string[],
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [a, p, c, u, t, tpl] = await Promise.all([
        listAreas(supabase),
        listProjects(supabase),
        listCampaigns(supabase),
        listProfiles(supabase),
        listTags(supabase),
        listTemplates(supabase),
      ]);
      setAreas(a);
      setProjects(p);
      setCampaigns(c);
      setProfiles(u);
      setTags(t);
      setTemplates(tpl);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!form.area_id) {
      setCategories([]);
      return;
    }
    listCategories(supabase, form.area_id).then(setCategories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.area_id]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    update("template_id", templateId);
    if (tpl?.area_id) update("area_id", tpl.area_id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !form.title.trim()) return;
    setSaving(true);
    try {
      const tpl = templates.find((t) => t.id === form.template_id);
      await createTask(supabase, {
        title: form.title,
        description: form.description || undefined,
        project_id: form.project_id || null,
        campaign_id: form.campaign_id || null,
        area_id: form.area_id || null,
        category_id: form.category_id || null,
        assigneeIds: form.assigneeIds,
        created_by: profile.id,
        priority: form.priority,
        status: form.status,
        due_date: form.due_date ? dateInputToISO(form.due_date) : null,
        template_id: form.template_id || null,
        tagIds: form.tagIds,
        checklistItems: tpl?.checklist_items?.map((c) => c.title),
      });
      toast.success("Tarefa criada com sucesso");
      onCreated?.();
      onClose();
      setForm({
        title: "", description: "", project_id: "", campaign_id: "", area_id: "",
        category_id: "", assigneeIds: [], priority: "media", status: defaultStatusKey,
        due_date: "", template_id: "", tagIds: [],
      });
    } catch (err) {
      toast.error("Erro ao criar tarefa");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogHeader title="Nova Tarefa" subtitle="Preencha os detalhes para criar uma nova atividade" onClose={onClose} />
      <form onSubmit={handleSubmit}>
        <DialogBody className="space-y-4">
          <div>
            <Label htmlFor="title">Título *</Label>
            <Input id="title" required value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Ex: Roteiro Reels — Suspensão da CNH" />
          </div>
          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" rows={3} value={form.description} onChange={(e) => update("description", e.target.value)} />
          </div>

          {templates.length > 0 && (
            <div>
              <Label>Template</Label>
              <Select value={form.template_id} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">Nenhum</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Área</Label>
              <Select value={form.area_id} onChange={(e) => update("area_id", e.target.value)}>
                <option value="">Selecione</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category_id} onChange={(e) => update("category_id", e.target.value)} disabled={!categories.length}>
                <option value="">Selecione</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Projeto</Label>
              <Select value={form.project_id} onChange={(e) => update("project_id", e.target.value)}>
                <option value="">Nenhum</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Campanha</Label>
              <Select value={form.campaign_id} onChange={(e) => update("campaign_id", e.target.value)}>
                <option value="">Nenhuma</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Responsáveis</Label>
              <AssigneesPicker profiles={profiles} selectedIds={form.assigneeIds} onChange={(ids) => update("assigneeIds", ids)} />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.priority} onChange={(e) => update("priority", e.target.value)}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onChange={(e) => update("status", e.target.value)}>
                {activeStatuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={form.due_date} onChange={(e) => update("due_date", e.target.value)} />
            </div>
          </div>

          {tags.length > 0 && (
            <div>
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const active = form.tagIds.includes(tag.id);
                  return (
                    <button
                      type="button"
                      key={tag.id}
                      onClick={() =>
                        update("tagIds", active ? form.tagIds.filter((id) => id !== tag.id) : [...form.tagIds, tag.id])
                      }
                      className="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
                      style={{
                        backgroundColor: active ? tag.color : `${tag.color}1a`,
                        color: active ? "#fff" : tag.color,
                      }}
                    >
                      #{tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving || !form.title.trim()}>
            {saving ? "Criando..." : "Criar tarefa"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
