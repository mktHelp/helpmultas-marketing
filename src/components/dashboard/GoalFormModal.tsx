"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Checkbox";
import { cn } from "@/lib/utils";
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
    content_type: editingGoal?.content_type || "",
    target_value: editingGoal?.target_value?.toString() || "",
    period_start: editingGoal?.period_start || monthRange.start,
    period_end: editingGoal?.period_end || monthRange.end,
    is_recurring: editingGoal?.is_recurring || false,
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
        metric: "content_published" as Goal["metric"],
        content_type: (form.content_type as ContentType) || null,
        target_value: Number(form.target_value),
        period_start: form.period_start,
        period_end: form.is_recurring ? null : form.period_end,
        is_recurring: form.is_recurring,
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
            <p className="flex h-10 items-center rounded-[14px] border border-gray-200 bg-gray-050 px-3.5 text-sm text-blue-900">
              Conteúdo publicado
            </p>
          </div>

          <div>
            <Label>Tipo de conteúdo</Label>
            <Select value={form.content_type} onChange={(e) => update("content_type", e.target.value)} required>
              <option value="">Selecione</option>
              {CONTENT_TYPES.map((ct) => (
                <option key={ct} value={ct}>{CONTENT_TYPE_LABEL[ct]}</option>
              ))}
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-[14px] border border-gray-200 px-3.5 py-2.5">
            <div>
              <p className="text-sm font-semibold text-blue-900">Meta contínua</p>
              <p className="text-xs text-gray-500">Todos os dias, sem data para acabar (ex: stories diários)</p>
            </div>
            <Switch checked={form.is_recurring} onCheckedChange={(v) => update("is_recurring", v)} />
          </div>

          <div>
            <Label>Meta (publicações {form.is_recurring ? "por dia" : "no período"})</Label>
            <Input
              type="number"
              min={1}
              value={form.target_value}
              onChange={(e) => update("target_value", e.target.value)}
              required
            />
          </div>

          <div className={cn("grid gap-4", form.is_recurring ? "grid-cols-1" : "grid-cols-2")}>
            <div>
              <Label>{form.is_recurring ? "A partir de" : "De"}</Label>
              <Input type="date" value={form.period_start} onChange={(e) => update("period_start", e.target.value)} required />
            </div>
            {!form.is_recurring && (
              <div>
                <Label>Até</Label>
                <Input type="date" value={form.period_end} onChange={(e) => update("period_end", e.target.value)} required />
              </div>
            )}
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
