"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, CopyPlus, ExternalLink, Kanban, ListChecks, Plus, ScanSearch, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { deletePlanPost, savePlanPost, sendPostToProduction } from "@/lib/services/contentPlan";
import {
  ACCOUNT_COLOR, ACCOUNT_LABEL, CAROUSEL_TEMPLATE, FORMAT_COLOR, FORMAT_LABEL, FUNNEL_COLOR, FUNNEL_LABEL, OBJECTIVE_SUGGESTIONS,
  PILLAR_SUGGESTIONS, REELS_TEMPLATE, STATUS_COLOR, STATUS_LABEL, STATUS_ORDER, emptyPost, findConfirmations,
} from "@/lib/contentPlan";
import { cn } from "@/lib/utils";
import type { ContentPlanPost, PlanAccount, PlanFormat, PlanFunnel, PlanPending, PlanScriptBlock, PlanStatus } from "@/types/database";

type Draft = Omit<ContentPlanPost, "id" | "created_at" | "updated_at" | "created_by"> & { id?: string };

function Segmented<T extends string>({
  value, options, onChange, ariaLabel,
}: {
  value: T | null;
  options: { value: T; label: string; color?: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-[12px] font-bold transition-all active:scale-95",
              active ? "border-transparent text-white shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-050"
            )}
            style={active ? { backgroundColor: o.color ?? "#243746" } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Editor de um post do planejamento: campos do cronograma + roteiro em blocos + pendências antes de gravar. */
export function PostDrawer({
  post, defaults, onClose, onSaved,
}: {
  post: ContentPlanPost | null;
  defaults: { account: PlanAccount; date: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useAuth();
  const [draft, setDraft] = useState<Draft>(() => (post ? { ...post } : emptyPost(defaults.account, defaults.date)));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isNew = !draft.id;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const blocks = draft.script_blocks;
  const setBlock = (i: number, patch: Partial<PlanScriptBlock>) =>
    set("script_blocks", blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const moveBlock = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    set("script_blocks", next);
  };

  const pending = draft.pending;
  const setPending = (i: number, patch: Partial<PlanPending>) => set("pending", pending.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const detected = useMemo(() => {
    const all = [...blocks.map((b) => b.text), draft.recording_notes, draft.caption, draft.cta].flatMap((t) => findConfirmations(t));
    return Array.from(new Set(all.map((s) => s.replace(/^\[CONFIRMAR:?\s*/i, "").replace(/\]$/, "").trim()).filter(Boolean)));
  }, [blocks, draft.recording_notes, draft.caption, draft.cta]);
  const newDetected = detected.filter((d) => !pending.some((p) => p.text === d));

  async function save(close = true) {
    if (!draft.theme.trim()) {
      toast.error("Dê um tema ao post.");
      return null;
    }
    setSaving(true);
    try {
      const saved = await savePlanPost(supabase, {
        ...draft,
        theme: draft.theme.trim(),
        pillar: draft.pillar?.trim() || null,
        objective: draft.objective?.trim() || null,
        script_blocks: blocks.filter((b) => b.label.trim() || b.text.trim()),
        pending: pending.filter((p) => p.text.trim()),
        ...(isNew ? { created_by: profile?.id ?? null } : {}),
      });
      toast.success(isNew ? "Post planejado" : "Post salvo");
      onSaved();
      if (close) onClose();
      return saved;
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível salvar o post.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function sendToProduction() {
    if (!profile) return;
    const saved = await save(false);
    if (!saved) return;
    try {
      await sendPostToProduction(supabase, saved, profile.id);
      toast.success("Tarefa criada na Produção");
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível criar a tarefa.");
    }
  }

  async function duplicate() {
    const { id, task_id, status, ...rest } = draft;
    void id; void task_id; void status;
    try {
      await savePlanPost(supabase, { ...rest, status: "planejado", task_id: null, created_by: profile?.id ?? null });
      toast.success("Post duplicado");
      onSaved();
      onClose();
    } catch {
      toast.error("Não foi possível duplicar.");
    }
  }

  async function remove() {
    if (!draft.id) return;
    try {
      await deletePlanPost(supabase, draft.id);
      toast.success("Post removido");
      onSaved();
      onClose();
    } catch {
      toast.error("Não foi possível remover.");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3.5">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-display text-sm font-bold text-blue-900">{isNew ? "Novo post" : "Editar post"}</p>
          <p className="truncate text-[11px] text-gray-500">{ACCOUNT_LABEL[draft.account]}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <div>
          <Label>Perfil</Label>
          <Segmented<PlanAccount>
            ariaLabel="Perfil"
            value={draft.account}
            onChange={(v) => set("account", v)}
            options={(["franchising", "roberson"] as PlanAccount[]).map((a) => ({ value: a, label: ACCOUNT_LABEL[a], color: ACCOUNT_COLOR[a] }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="plan-date">Data de publicação</Label>
            <Input id="plan-date" type="date" value={draft.publish_date} onChange={(e) => e.target.value && set("publish_date", e.target.value)} />
          </div>
          <div>
            <Label>Formato</Label>
            <Segmented<PlanFormat>
              ariaLabel="Formato"
              value={draft.format}
              onChange={(v) => set("format", v)}
              options={(["reels", "carrossel", "feed"] as PlanFormat[]).map((f) => ({ value: f, label: FORMAT_LABEL[f], color: FORMAT_COLOR[f] }))}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="plan-theme">Tema</Label>
          <Input id="plan-theme" value={draft.theme} onChange={(e) => set("theme", e.target.value)} placeholder="Ex.: Querer empreender x estar preparado" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="plan-pillar">Pilar</Label>
            <Input id="plan-pillar" list="plan-pillars" value={draft.pillar ?? ""} onChange={(e) => set("pillar", e.target.value)} placeholder="Ex.: Mentalidade" />
            <datalist id="plan-pillars">{PILLAR_SUGGESTIONS[draft.account].map((p) => <option key={p} value={p} />)}</datalist>
          </div>
          <div>
            <Label htmlFor="plan-objective">Objetivo</Label>
            <Input id="plan-objective" list="plan-objectives" value={draft.objective ?? ""} onChange={(e) => set("objective", e.target.value)} placeholder="Ex.: Confiança" />
            <datalist id="plan-objectives">{OBJECTIVE_SUGGESTIONS.map((p) => <option key={p} value={p} />)}</datalist>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Funil</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              <Segmented<PlanFunnel>
                ariaLabel="Funil"
                value={draft.funnel}
                onChange={(v) => set("funnel", draft.funnel === v ? null : v)}
                options={(["topo", "meio", "fundo"] as PlanFunnel[]).map((f) => ({ value: f, label: FUNNEL_LABEL[f], color: FUNNEL_COLOR[f] }))}
              />
            </div>
          </div>
          <div>
            <Label>Post fixado no perfil</Label>
            <Segmented<string>
              ariaLabel="Post fixado"
              value={draft.pinned_slot ? String(draft.pinned_slot) : "0"}
              onChange={(v) => set("pinned_slot", v === "0" ? null : Number(v))}
              options={[{ value: "0", label: "Não" }, { value: "1", label: "01" }, { value: "2", label: "02" }, { value: "3", label: "03" }]}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="plan-duration">Duração</Label>
            <Input id="plan-duration" value={draft.duration ?? ""} onChange={(e) => set("duration", e.target.value)} placeholder="40 a 50 segundos · 9 slides" />
          </div>
          <div>
            <Label htmlFor="plan-trigger">Gatilho</Label>
            <Input id="plan-trigger" value={draft.trigger ?? ""} onChange={(e) => set("trigger", e.target.value)} placeholder="Ex.: vaidade e preguiça" />
          </div>
        </div>

        <div>
          <Label>Etapa</Label>
          <Segmented<PlanStatus>
            ariaLabel="Etapa"
            value={draft.status}
            onChange={(v) => set("status", v)}
            options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s], color: STATUS_COLOR[s] }))}
          />
        </div>

        {/* Roteiro em blocos */}
        <section>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Label className="!mb-0">Roteiro</Label>
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[12px] font-semibold text-gray-600">
              <input type="checkbox" checked={draft.no_script} onChange={(e) => set("no_script", e.target.checked)} className="h-3.5 w-3.5 accent-[#e0a900]" />
              Sem roteiro (acervo)
            </label>
          </div>
          {!draft.no_script && (
            <>
              <ul className="space-y-2.5">
                {blocks.map((b, i) => (
                  <li key={i} className="rounded-xl border border-gray-200 bg-gray-050/60 p-2.5">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <Input value={b.label} onChange={(e) => setBlock(i, { label: e.target.value })} placeholder="Bloco (Hook, Insight…)" className="h-8 flex-1 font-bold" />
                      <Input value={b.timing} onChange={(e) => setBlock(i, { timing: e.target.value })} placeholder="0 a 3s" className="h-8 w-24" />
                      <button type="button" onClick={() => moveBlock(i, -1)} disabled={i === 0} aria-label="Subir bloco" className="rounded-full p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1} aria-label="Descer bloco" className="rounded-full p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => set("script_blocks", blocks.filter((_, j) => j !== i))} aria-label="Remover bloco" className="rounded-full p-1 text-gray-400 hover:bg-red-50 hover:text-[color:var(--color-danger)]"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    <Textarea rows={3} value={b.text} onChange={(e) => setBlock(i, { text: e.target.value })} placeholder="Fala ou texto do slide. Use [CONFIRMAR: …] para o que depende de dado real." />
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => set("script_blocks", [...blocks, { label: "", timing: "", text: "" }])} className="gap-1"><Plus className="h-3.5 w-3.5" /> Bloco</Button>
                {blocks.length === 0 && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => set("script_blocks", REELS_TEMPLATE.map((b) => ({ ...b })))}>Modelo de Reels</Button>
                    <Button size="sm" variant="ghost" onClick={() => set("script_blocks", CAROUSEL_TEMPLATE.map((b) => ({ ...b })))}>Modelo de carrossel (9 slides)</Button>
                  </>
                )}
              </div>
            </>
          )}
        </section>

        <div>
          <Label htmlFor="plan-rec">{draft.format === "carrossel" ? "Design" : "Gravação"}</Label>
          <Textarea id="plan-rec" rows={3} value={draft.recording_notes ?? ""} onChange={(e) => set("recording_notes", e.target.value)} placeholder="Como gravar ou desenhar: cenas, locais, o que mostrar na tela." />
        </div>
        <div>
          <Label htmlFor="plan-caption">Legenda sugerida</Label>
          <Textarea id="plan-caption" rows={3} value={draft.caption ?? ""} onChange={(e) => set("caption", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="plan-cta">CTA</Label>
          <Textarea id="plan-cta" rows={2} value={draft.cta ?? ""} onChange={(e) => set("cta", e.target.value)} />
        </div>

        {/* Pendências */}
        <section>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ListChecks className="h-4 w-4 text-blue-700" />
            <Label className="!mb-0">Pendências antes de gravar</Label>
            {newDetected.length > 0 && (
              <button
                type="button"
                onClick={() => set("pending", [...pending, ...newDetected.map((text) => ({ text, done: false }))])}
                className="ml-auto inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-1 text-[11.5px] font-bold text-yellow-900 hover:bg-yellow-200"
              >
                <ScanSearch className="h-3 w-3" /> Trazer {newDetected.length} dos [CONFIRMAR]
              </button>
            )}
          </div>
          <ul className="space-y-1.5">
            {pending.map((p, i) => (
              <li key={i} className="flex items-center gap-2">
                <input type="checkbox" checked={p.done} onChange={(e) => setPending(i, { done: e.target.checked })} aria-label="Confirmado" className="h-3.5 w-3.5 shrink-0 accent-[#e0a900]" />
                <Input value={p.text} onChange={(e) => setPending(i, { text: e.target.value })} className={cn("h-8", p.done && "text-gray-400 line-through")} />
                <button type="button" onClick={() => set("pending", pending.filter((_, j) => j !== i))} aria-label="Remover pendência" className="rounded-full p-1 text-gray-400 hover:bg-red-50 hover:text-[color:var(--color-danger)]"><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="secondary" onClick={() => set("pending", [...pending, { text: "", done: false }])} className="mt-2 gap-1"><Plus className="h-3.5 w-3.5" /> Pendência</Button>
        </section>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-gray-100 bg-white p-3">
        {!isNew && (
          <>
            <button type="button" onClick={() => setConfirmDelete(true)} aria-label="Remover post" className="rounded-full p-2 text-gray-400 hover:bg-red-50 hover:text-[color:var(--color-danger)]"><Trash2 className="h-4 w-4" /></button>
            <button type="button" onClick={duplicate} aria-label="Duplicar post" title="Duplicar" className="rounded-full p-2 text-gray-500 hover:bg-gray-100"><CopyPlus className="h-4 w-4" /></button>
            {draft.task_id ? (
              <Link href={`/tasks/${draft.task_id}`} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-bold text-blue-700 hover:bg-gray-100"><ExternalLink className="h-3.5 w-3.5" /> Ver tarefa</Link>
            ) : (
              <Button size="sm" variant="secondary" onClick={sendToProduction} disabled={saving} className="gap-1.5"><Kanban className="h-3.5 w-3.5" /> Enviar p/ Produção</Button>
            )}
          </>
        )}
        <Button onClick={() => save()} disabled={saving} className="ml-auto h-10 min-w-32 rounded-full">{saving ? "Salvando…" : "Salvar"}</Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Remover post"
        description="O post sai do planejamento. A tarefa de produção, se existir, continua no quadro."
        confirmLabel="Remover"
        danger
      />
    </div>
  );
}
