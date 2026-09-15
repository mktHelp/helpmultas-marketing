"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { createGoal, updateGoal } from "@/lib/services/goals";
import { CONTENT_TYPE_LABEL } from "@/lib/stats";
import type { Area, ContentType, Goal, Profile } from "@/types/database";

const CONTENT_TYPES: ContentType[] = [
  "reels", "stories", "feed", "carrossel", "youtube", "blog", "email", "whatsapp", "anuncio", "landing_page",
];

function defaultMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function GoalFormModal({
  open,
  onClose,
  onSaved,
  areas,
  profiles,
  editingGoal,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  areas: Area[];
  profiles: Profile[];
  editingGoal?: Goal | null;
}) {
  const { profile } = useAuth();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const monthRange = defaultMonthRange();

  const [form, setForm] = useState({
    scope: editingGoal?.scope || "company",
    area_id: editingGoal?.area_id || "",
    user_id: editingGoal?.user_id || "",
    metric: editingGoal?.metric || "content_published",
    content_type: editingGoal?.content_type || "",
    target_value: editingGoal?.target_value?.toString() || "",
    period_start: editingGoal?.period_start || monthRange.start,
    period_end: editingGoal?.period_end || monthRange.end,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !form.target_value) return;
    setSaving(true);
    try {
      const payload = {
        scope: form.scope as Goal["scope"],
        area_id: form.scope === "area" ? form.area_id || null : null,
        user_id: form.scope === "user" ? form.user_id || null : null,
        metric: form.metric as Goal["metric"],
        content_type: form.metric === "content_published" ? (form.content_type as ContentType) || null : null,
        target_value: Number(form.target_value),
        period_start: form.period_start,
        period_end: form.period_end,
        created_by: profile.id,
      };
      if (editingGoal) {
        await updateGoal(supabase, editingGoal.id, payload);
      } else {
        await createGoal(supabase, payload);
      }
      toast.success("Meta salva");
      onSaved();
      onClose();
    } catch (err) {
      toast.error("Erro ao salvar meta");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} size="sm">
      <DialogHeader title={editingGoal ? "Editar meta" : "Nova meta"} onClose={onClose} />
      <form onSubmit={handleSubmit}>
        <DialogBody className="space-y-4">
          <div>
            <Label>Abrangência</Label>
            <Select value={form.scope} onChange={(e) => update("scope", e.target.value as Goal["scope"])}>
              <option value="company">Empresa (geral)</option>
              <option value="area">Área/time</option>
              <option value="user">Pessoa</option>
            </Select>
          </div>

          {form.scope === "area" && (
            <div>
              <Label>Área</Label>
              <Select value={form.area_id} onChange={(e) => update("area_id", e.target.value)} required>
                <option value="">Selecione</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
          )}

          {form.scope === "user" && (
            <div>
              <Label>Pessoa</Label>
              <Select value={form.user_id} onChange={(e) => update("user_id", e.target.value)} required>
                <option value="">Selecione</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </Select>
            </div>
          )}

          <div>
            <Label>Métrica</Label>
            <Select value={form.metric} onChange={(e) => update("metric", e.target.value as Goal["metric"])}>
              <option value="content_published">Conteúdo publicado (ex: 4 stories)</option>
              <option value="tasks_completed">Tarefas concluídas (quantidade)</option>
              <option value="on_time_rate">Taxa de entrega no prazo (%)</option>
            </Select>
          </div>

          {form.metric === "content_published" && (
            <div>
              <Label>Tipo de conteúdo</Label>
              <Select value={form.content_type} onChange={(e) => update("content_type", e.target.value)} required>
                <option value="">Selecione</option>
                {CONTENT_TYPES.map((ct) => (
                  <option key={ct} value={ct}>{CONTENT_TYPE_LABEL[ct]}</option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <Label>Meta ({form.metric === "on_time_rate" ? "%" : form.metric === "content_published" ? "publicações" : "tarefas"})</Label>
            <Input
              type="number"
              min={1}
              value={form.target_value}
              onChange={(e) => update("target_value", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>De</Label>
              <Input type="date" value={form.period_start} onChange={(e) => update("period_start", e.target.value)} required />
            </div>
            <div>
              <Label>Até</Label>
              <Input type="date" value={form.period_end} onChange={(e) => update("period_end", e.target.value)} required />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving || !form.target_value}>
            {saving ? "Salvando..." : "Salvar meta"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
