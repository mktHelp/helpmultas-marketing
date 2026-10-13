"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/Dialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { deleteLeadsAction, updateLeadAction, type LeadEditInput } from "@/app/(app)/trafego-pago/leads/actions";

// Edição e exclusão de leads (só Master). landing_page_leads alimenta as abas
// Leads e Reuniões, então o que muda aqui muda nas duas.

export interface LeadRef {
  id: string;
  name: string;
}

interface FullLead {
  id: string;
  crm_lead_id: string | null;
  crm_locked: boolean;
  [key: string]: unknown;
}

const CONTACT_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "Nome" },
  { key: "email", label: "E-mail" },
  { key: "phone", label: "Telefone" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "UF" },
  { key: "capital_label", label: "Capital para investir (texto)" },
  { key: "capital", label: "Capital (valor)" },
];

const UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id"];

const CRM_TEXT_FIELDS: { key: string; label: string }[] = [
  { key: "crm_category_name", label: "Categoria" },
  { key: "crm_stage_name", label: "Etapa" },
  { key: "crm_phase_name", label: "Fase" },
  { key: "crm_funnel_name", label: "Funil" },
  { key: "last_meeting_status", label: "Status da última reunião" },
];

const CRM_COUNT_FIELDS: { key: string; label: string }[] = [
  { key: "meetings_count", label: "Reuniões" },
  { key: "meetings_no_show", label: "No-show" },
  { key: "meetings_rescheduled", label: "Reagendadas" },
];

const CRM_DATE_FIELDS: { key: string; label: string }[] = [
  { key: "first_meeting_at", label: "Primeira reunião" },
  { key: "last_meeting_at", label: "Última reunião" },
];

const ALL_KEYS = [
  ...CONTACT_FIELDS.map((f) => f.key),
  ...UTM_FIELDS,
  ...CRM_TEXT_FIELDS.map((f) => f.key),
  ...CRM_COUNT_FIELDS.map((f) => f.key),
  ...CRM_DATE_FIELDS.map((f) => f.key),
];
const CRM_KEYS = new Set([...CRM_TEXT_FIELDS, ...CRM_COUNT_FIELDS, ...CRM_DATE_FIELDS].map((f) => f.key));

// ISO -> valor de <input type="datetime-local"> no fuso local.
function toLocalInput(iso: unknown) {
  if (typeof iso !== "string" || !iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="border-b border-gray-100 pb-1 text-xs font-bold uppercase tracking-wide text-gray-400">{title}</h3>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function LeadEditDialog({ lead, onClose, onSaved }: { lead: LeadRef | null; onClose: () => void; onSaved: () => void }) {
  const [full, setFull] = useState<FullLead | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lead) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFull(null);
    createClient()
      .from("landing_page_leads")
      .select("*")
      .eq("id", lead.id)
      .single()
      .then(({ data, error: e }) => {
        if (cancelled) return;
        setLoading(false);
        if (e || !data) {
          setError(e?.message ?? "Lead não encontrado");
          return;
        }
        const row = data as FullLead;
        const next: Record<string, string> = {};
        for (const k of ALL_KEYS) {
          const v = row[k];
          next[k] = CRM_DATE_FIELDS.some((f) => f.key === k) ? toLocalInput(v) : v === null || v === undefined ? "" : String(v);
        }
        setFull(row);
        setForm(next);
        setLocked(!!row.crm_locked);
      });
    return () => {
      cancelled = true;
    };
  }, [lead]);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    // Mexeu em dado vindo do CRM: trava pra a próxima sincronização não desfazer.
    if (CRM_KEYS.has(key)) setLocked(true);
  }

  async function save() {
    if (!full) return;
    setSaving(true);
    setError(null);
    try {
      const input: Record<string, unknown> = { crm_locked: locked };
      for (const k of ALL_KEYS) {
        if (CRM_DATE_FIELDS.some((f) => f.key === k)) input[k] = form[k] ? new Date(form[k]).toISOString() : null;
        else if (CRM_COUNT_FIELDS.some((f) => f.key === k)) input[k] = form[k] === "" ? 0 : Number(form[k]);
        else input[k] = form[k];
      }
      await updateLeadAction(full.id, input as LeadEditInput);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const input = (key: string, label: string, type = "text") => (
    <div key={key}>
      <Label htmlFor={`edit-${key}`}>{label}</Label>
      <Input
        id={`edit-${key}`}
        type={type}
        min={type === "number" ? 0 : undefined}
        value={form[key] ?? ""}
        onChange={(e) => set(key, e.target.value)}
      />
    </div>
  );

  return (
    <Dialog open={!!lead} onClose={onClose} size="lg">
      <DialogHeader title="Editar lead" subtitle={lead?.name || undefined} onClose={onClose} />
      <DialogBody className="space-y-6">
        {loading && <p className="py-6 text-center text-sm text-gray-500">Carregando...</p>}
        {full && (
          <>
            <Section title="Contato">{CONTACT_FIELDS.map((f) => input(f.key, f.label))}</Section>
            <Section
              title="UTMs"
              hint="Ao salvar, o vínculo com campanha, conjunto e anúncio é refeito com as UTMs novas."
            >
              {UTM_FIELDS.map((k) => input(k, k))}
            </Section>
            <Section
              title="Dados do CRM"
              hint={
                full.crm_lead_id
                  ? "Estes dados vêm do CRM a cada 3h. Ao alterar algum, eles ficam travados e o CRM deixa de sobrescrevê-los."
                  : "Este lead ainda não está no CRM. Se você preencher aqui e travar, o CRM não sobrescreverá quando ele chegar."
              }
            >
              {CRM_TEXT_FIELDS.map((f) => input(f.key, f.label))}
              {CRM_COUNT_FIELDS.map((f) => input(f.key, f.label, "number"))}
              {CRM_DATE_FIELDS.map((f) => input(f.key, f.label, "datetime-local"))}
              <label className="flex items-center gap-2 text-sm text-blue-900 sm:col-span-2">
                <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} className="h-4 w-4 accent-yellow-500" />
                Travar dados do CRM (a sincronização não sobrescreve)
              </label>
            </Section>
          </>
        )}
        {error && <p className="text-sm text-[color:var(--color-danger)]">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={save} disabled={!full || saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

export function LeadDeleteDialog({ lead, onClose, onDeleted }: { lead: LeadRef | null; onClose: () => void; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [lead]);

  async function confirm() {
    if (!lead) return;
    setLoading(true);
    setError(null);
    try {
      await deleteLeadsAction([lead.id]);
      onDeleted();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ConfirmDialog
      open={!!lead}
      onClose={onClose}
      onConfirm={confirm}
      loading={loading}
      danger
      title="Excluir lead definitivamente"
      confirmLabel="Excluir"
      description={`${lead?.name || "Este lead"} será removido das abas Leads e Reuniões e não voltará nas próximas sincronizações do CRM. Essa ação não pode ser desfeita.${error ? ` Erro: ${error}` : ""}`}
    />
  );
}

// Botões de editar/excluir de uma linha — o chamador só renderiza para o Master.
export function LeadRowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={onEdit}
        title="Editar lead"
        aria-label="Editar lead"
        className="rounded-full p-1.5 text-gray-500 hover:bg-blue-050 hover:text-blue-900"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        title="Excluir lead"
        aria-label="Excluir lead"
        className="rounded-full p-1.5 text-gray-500 hover:bg-[color:var(--color-danger-bg)] hover:text-[color:var(--color-danger)]"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// Botões do modal de detalhes do lead (só Master).
export function LeadDialogActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onEdit}
        className="rounded-full border border-blue-900 px-3 py-1.5 text-xs font-semibold text-blue-900 hover:bg-blue-900 hover:text-white"
      >
        Editar lead
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-full border border-[color:var(--color-danger)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger-bg)]"
      >
        Excluir lead
      </button>
    </>
  );
}
