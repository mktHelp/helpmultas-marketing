"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlignLeft, CalendarClock, ChevronDown, Clock, Flag, FolderKanban, Layers, ListPlus, Loader2, Megaphone, Plus,
  Shapes, Tag as TagIcon, Users, X, Zap,
} from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  AssigneeChips, ContentTypeSelector, FieldLabel, PrioritySelector, QuickDates, StatusSelector, inputClass,
} from "./TaskFormParts";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { listAreas, listCategories, listTags, listTemplates } from "@/lib/services/reference";
import { listProjects, listCampaigns } from "@/lib/services/projects";
import { listProfiles } from "@/lib/services/profiles";
import { createTask } from "@/lib/services/tasks";
import { useTaskStatuses } from "@/lib/task-status-context";
import { cn, dateInputToISO } from "@/lib/utils";
import type { Area, Campaign, Category, ContentType, Profile, Project, Tag, TaskPriority, TaskTemplate } from "@/types/database";

const ESTIMATE_PRESETS = [
  { label: "30 min", minutes: 30 },
  { label: "1 h", minutes: 60 },
  { label: "2 h", minutes: 120 },
  { label: "4 h", minutes: 240 },
];

export function CreateTaskModal({
  open,
  onClose,
  onCreated,
  defaultStatus,
  defaultProjectId,
  defaultCampaignId,
  defaultTitle,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  defaultStatus?: string;
  defaultProjectId?: string;
  defaultCampaignId?: string;
  defaultTitle?: string;
}) {
  const { profile } = useAuth();
  const { activeStatuses, defaultStatusKey } = useTaskStatuses();
  const supabase = useMemo(() => createClient(), []);

  const [areas, setAreas] = useState<Area[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const makeInitial = () => ({
    title: defaultTitle || "",
    description: "",
    project_id: defaultProjectId || "",
    campaign_id: defaultCampaignId || "",
    area_id: "",
    category_id: "",
    assigneeIds: [] as string[],
    priority: "media" as TaskPriority,
    status: defaultStatus || defaultStatusKey,
    due_date: "",
    template_id: "",
    tagIds: [] as string[],
    estimated_minutes: "",
    content_type: "" as ContentType | "",
  });
  const [form, setForm] = useState(makeInitial);

  // A cada abertura o formulário recomeça do zero, já com os padrões recebidos
  // (título sugerido, etapa da coluna, projeto/campanha da página).
  useEffect(() => {
    if (!open) return;
    setForm(makeInitial());
    setMoreOpen(!!(defaultProjectId || defaultCampaignId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
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
      } catch {
        toast.error("Não foi possível carregar as opções do formulário");
      }
    })();
  }, [open, supabase]);

  useEffect(() => {
    if (!form.area_id) {
      setCategories([]);
      return;
    }
    listCategories(supabase, form.area_id).then(setCategories).catch(() => setCategories([]));
  }, [form.area_id, supabase]);

  function update<K extends keyof ReturnType<typeof makeInitial>>(key: K, value: ReturnType<typeof makeInitial>[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    setForm((f) => ({
      ...f,
      template_id: templateId,
      area_id: tpl?.area_id || f.area_id,
      content_type: (tpl?.content_type as ContentType | null) || f.content_type,
    }));
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!profile || !form.title.trim() || saving) return;
    setSaving(true);
    try {
      const tpl = templates.find((t) => t.id === form.template_id);
      await createTask(supabase, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
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
        estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
        content_type: form.content_type || null,
        tagIds: form.tagIds,
        checklistItems: tpl?.checklist_items?.map((c) => c.title),
      });
      toast.success("Tarefa criada com sucesso");
      onCreated?.();
      onClose();
    } catch (err) {
      toast.error("Erro ao criar tarefa");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const detailsCount =
    (form.area_id ? 1 : 0) + (form.project_id ? 1 : 0) + (form.campaign_id ? 1 : 0) + (form.template_id ? 1 : 0) +
    (form.estimated_minutes ? 1 : 0) + (form.tagIds.length ? 1 : 0);

  return (
    <Dialog open={open} onClose={onClose} size="xl" className="!rounded-3xl sm:!rounded-3xl">
      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void handleSubmit();
        }}
      >
        {/* Cabeçalho */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 px-5 py-5 text-white sm:px-7">
          <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-yellow-500/20 blur-3xl" aria-hidden />
          <div className="relative flex items-center gap-3.5">
            <span className="ast-float flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-500 text-blue-900 shadow-lg">
              <ListPlus className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-bold">Nova tarefa</h2>
              <p className="text-sm text-blue-100">Comece pelo título — o resto você ajusta depois, se quiser.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="shrink-0 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-6 px-5 py-6 sm:px-7">
          {/* Título + descrição */}
          <div className="space-y-3">
            <input
              id="title"
              required
              autoFocus
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Título da tarefa — Ex: Roteiro Reels, Suspensão da CNH"
              aria-label="Título"
              className="w-full border-0 border-b-2 border-gray-200 bg-transparent px-0 pb-2 font-display text-xl font-bold text-blue-900 placeholder:font-semibold placeholder:text-gray-300 transition-colors focus:border-yellow-500 focus:outline-none focus:ring-0"
              style={{ fontSize: 20 }}
            />
            <div>
              <FieldLabel icon={AlignLeft} htmlFor="description">Descrição</FieldLabel>
              <textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="O que precisa ser feito? Links, referências, observações…"
                className="w-full resize-none rounded-[14px] border border-gray-200 bg-white px-3.5 py-2.5 text-blue-900 placeholder:text-gray-400 transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-yellow-500"
                style={{ fontSize: 16 }}
              />
            </div>
          </div>

          {/* Prioridade + prazo */}
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <FieldLabel icon={Flag}>Prioridade</FieldLabel>
              <PrioritySelector value={form.priority} onChange={(v) => update("priority", v)} />
            </div>
            <div>
              <FieldLabel icon={CalendarClock} htmlFor="due">Prazo</FieldLabel>
              <input id="due" type="date" value={form.due_date} onChange={(e) => update("due_date", e.target.value)} className={inputClass} style={{ fontSize: 16 }} />
              <QuickDates value={form.due_date} onChange={(v) => update("due_date", v)} />
            </div>
          </div>

          {/* Etapa */}
          <div>
            <FieldLabel icon={Layers}>Etapa</FieldLabel>
            <StatusSelector statuses={activeStatuses} value={form.status} onChange={(v) => update("status", v)} />
          </div>

          {/* Responsáveis */}
          <div>
            <FieldLabel icon={Users}>Responsáveis</FieldLabel>
            <AssigneeChips profiles={profiles} selectedIds={form.assigneeIds} onChange={(ids) => update("assigneeIds", ids)} />
          </div>

          {/* Tipo de conteúdo */}
          <div>
            <FieldLabel icon={Shapes}>Tipo de conteúdo</FieldLabel>
            <ContentTypeSelector value={form.content_type} onChange={(v) => update("content_type", v)} />
          </div>

          {/* Mais detalhes (recolhido por padrão) */}
          <div className="rounded-2xl border border-gray-200">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
            >
              <Plus className={cn("h-4 w-4 text-blue-700 transition-transform duration-300", moreOpen && "rotate-45")} />
              <span className="flex-1 font-display text-sm font-bold text-blue-900">Mais detalhes</span>
              <span className="hidden text-xs text-gray-400 sm:inline">área, projeto, campanha, tempo, tags, template</span>
              {detailsCount > 0 && <span className="ast-pop rounded-full bg-yellow-500 px-1.5 text-[11px] font-bold text-blue-900">{detailsCount}</span>}
              <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform duration-300", moreOpen && "rotate-180")} />
            </button>
            <div className={cn("grid transition-[grid-template-rows,opacity] duration-300", moreOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
              <div className="min-h-0 overflow-hidden">
                <div className="space-y-5 border-t border-gray-100 px-4 pb-5 pt-4">
                  {templates.length > 0 && (
                    <div>
                      <FieldLabel icon={Zap}>Template</FieldLabel>
                      <Select value={form.template_id} onChange={(e) => applyTemplate(e.target.value)} style={{ fontSize: 16 }}>
                        <option value="">Nenhum</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </Select>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel icon={FolderKanban}>Área</FieldLabel>
                      <Select value={form.area_id} onChange={(e) => setForm((f) => ({ ...f, area_id: e.target.value, category_id: "" }))} style={{ fontSize: 16 }}>
                        <option value="">Selecione</option>
                        {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </Select>
                    </div>
                    <div>
                      <FieldLabel>Categoria</FieldLabel>
                      <Select value={form.category_id} onChange={(e) => update("category_id", e.target.value)} disabled={!categories.length} style={{ fontSize: 16 }}>
                        <option value="">{form.area_id ? "Selecione" : "Escolha uma área primeiro"}</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </Select>
                    </div>
                    <div>
                      <FieldLabel icon={FolderKanban}>Projeto</FieldLabel>
                      <Select value={form.project_id} onChange={(e) => update("project_id", e.target.value)} style={{ fontSize: 16 }}>
                        <option value="">Nenhum</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </Select>
                    </div>
                    <div>
                      <FieldLabel icon={Megaphone}>Campanha</FieldLabel>
                      <Select value={form.campaign_id} onChange={(e) => update("campaign_id", e.target.value)} style={{ fontSize: 16 }}>
                        <option value="">Nenhuma</option>
                        {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </Select>
                    </div>
                  </div>

                  <div>
                    <FieldLabel icon={Clock} htmlFor="estimate">Tempo estimado</FieldLabel>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        id="estimate"
                        type="number"
                        min={0}
                        inputMode="numeric"
                        placeholder="minutos"
                        value={form.estimated_minutes}
                        onChange={(e) => update("estimated_minutes", e.target.value)}
                        className={cn(inputClass, "w-32")}
                        style={{ fontSize: 16 }}
                      />
                      {ESTIMATE_PRESETS.map((p) => (
                        <button
                          key={p.minutes}
                          type="button"
                          onClick={() => update("estimated_minutes", String(p.minutes))}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-bold transition-all active:scale-95",
                            form.estimated_minutes === String(p.minutes) ? "border-yellow-500 bg-yellow-100 text-blue-900" : "border-gray-200 text-gray-600 hover:bg-gray-050"
                          )}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {tags.length > 0 && (
                    <div>
                      <FieldLabel icon={TagIcon}>Tags</FieldLabel>
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => {
                          const active = form.tagIds.includes(tag.id);
                          return (
                            <button
                              type="button"
                              key={tag.id}
                              aria-pressed={active}
                              onClick={() => update("tagIds", active ? form.tagIds.filter((id) => id !== tag.id) : [...form.tagIds, tag.id])}
                              className="rounded-full px-3 py-1.5 text-xs font-bold transition-all active:scale-95"
                              style={{ backgroundColor: active ? tag.color : `${tag.color}1a`, color: active ? "#fff" : tag.color }}
                            >
                              #{tag.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé fixo */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-gray-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
          <span className="mr-auto hidden text-xs text-gray-400 md:inline">
            <kbd className="font-sans font-bold">Ctrl</kbd> + <kbd className="font-sans font-bold">Enter</kbd> cria
          </span>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving || !form.title.trim()} className="min-w-[8.5rem] gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? "Criando..." : "Criar tarefa"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
