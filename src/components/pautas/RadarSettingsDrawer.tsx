"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bot, Check, Gauge, Hash, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { RADAR_EFFORTS, RADAR_MODELS, saveRadarSettings } from "@/lib/services/contentIdeas";
import { createClient } from "@/lib/supabase/client";
import type { ContentRadarSettings, RadarReasoningEffort } from "@/types/database";
import { cn } from "@/lib/utils";

const CUSTOM = "__custom";

function Option({ active, title, hint, onClick }: { active: boolean; title: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.99]",
        active ? "border-yellow-500 bg-yellow-050 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-050"
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-blue-900">{title}</span>
        <span className="block text-[11px] text-gray-500">{hint}</span>
      </span>
      <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", active ? "border-yellow-500 bg-yellow-500 text-blue-900" : "border-gray-300")}>
        {active && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
    </button>
  );
}

/** Ajustes do Radar de Pauta: modelo, esforço de raciocínio, quantidade e preços. Vale a partir da próxima geração. */
export function RadarSettingsDrawer({
  settings, userId, canEdit, onSaved, onClose,
}: {
  settings: ContentRadarSettings;
  userId: string;
  canEdit: boolean;
  onSaved: (s: ContentRadarSettings) => void;
  onClose: () => void;
}) {
  const known = RADAR_MODELS.find((m) => m.id === settings.model);
  const [modelChoice, setModelChoice] = useState<string>(known ? known.id : CUSTOM);
  const [customModel, setCustomModel] = useState(known ? "" : settings.model);
  const [effort, setEffort] = useState<RadarReasoningEffort>(settings.reasoning_effort);
  const [qtd, setQtd] = useState(settings.qtd_pautas);
  const [priceIn, setPriceIn] = useState(String(settings.price_in_usd_1m));
  const [priceOut, setPriceOut] = useState(String(settings.price_out_usd_1m));
  const [saving, setSaving] = useState(false);

  function pickModel(id: string) {
    setModelChoice(id);
    const m = RADAR_MODELS.find((x) => x.id === id);
    if (m) {
      setPriceIn(String(m.priceIn));
      setPriceOut(String(m.priceOut));
    }
  }

  const model = modelChoice === CUSTOM ? customModel.trim() : modelChoice;
  const pIn = Number(priceIn.replace(",", "."));
  const pOut = Number(priceOut.replace(",", "."));
  const valid = !!model && Number.isFinite(pIn) && pIn >= 0 && Number.isFinite(pOut) && pOut >= 0 && qtd >= 4 && qtd <= 20;

  async function save() {
    if (!valid) return;
    setSaving(true);
    try {
      const saved = await saveRadarSettings(createClient(), userId, {
        model, reasoning_effort: effort, qtd_pautas: qtd, price_in_usd_1m: pIn, price_out_usd_1m: pOut,
      });
      onSaved(saved);
      toast.success("Ajustes salvos. Valem a partir da próxima geração.");
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível salvar os ajustes.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-blue-900 outline-none focus:border-blue-900 disabled:bg-gray-050";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-900 text-yellow-500">
          <SlidersHorizontal className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-display text-sm font-bold text-blue-900">Ajustes da IA</p>
          <p className="text-[11px] text-gray-500">Valem a partir da próxima geração de pautas</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar ajustes" className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <fieldset disabled={!canEdit} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
        {!canEdit && <p className="rounded-xl bg-gray-050 p-3 text-xs text-gray-600">Só gestores alteram estes ajustes.</p>}

        <section>
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-gray-500"><Bot className="h-3.5 w-3.5 text-blue-700" /> Modelo</p>
          <div className="space-y-1.5">
            {RADAR_MODELS.map((m) => (
              <Option key={m.id} active={modelChoice === m.id} title={m.label} hint={`${m.hint} · US$ ${m.priceIn} / ${m.priceOut} por 1M tokens`} onClick={() => pickModel(m.id)} />
            ))}
            <Option active={modelChoice === CUSTOM} title="Outro modelo" hint="Digite o nome exato do modelo e os preços" onClick={() => setModelChoice(CUSTOM)} />
            {modelChoice === CUSTOM && (
              <input value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="ex.: gpt-5.1" aria-label="Nome do modelo" className={inputCls} />
            )}
          </div>
        </section>

        <section>
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-gray-500"><Gauge className="h-3.5 w-3.5 text-blue-700" /> Esforço de raciocínio</p>
          <div className="space-y-1.5">
            {RADAR_EFFORTS.map((e) => (
              <Option key={e.id} active={effort === e.id} title={e.label} hint={e.hint} onClick={() => setEffort(e.id as RadarReasoningEffort)} />
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-gray-400">Mais esforço = pautas mais pensadas, porém mais lentas e mais caras.</p>
        </section>

        <section>
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-gray-500"><Hash className="h-3.5 w-3.5 text-blue-700" /> Pautas por geração</p>
          <div className="flex items-center gap-3">
            <input type="range" min={4} max={20} value={qtd} onChange={(e) => setQtd(Number(e.target.value))} aria-label="Pautas por geração" className="flex-1 accent-yellow-500" />
            <span className="w-8 text-right font-display text-sm font-bold text-blue-900">{qtd}</span>
          </div>
        </section>

        <section>
          <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-gray-500">Preço (US$ por 1M de tokens)</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-semibold text-gray-500">
              Entrada
              <input inputMode="decimal" value={priceIn} onChange={(e) => setPriceIn(e.target.value)} className={cn(inputCls, "mt-1")} />
            </label>
            <label className="text-[11px] font-semibold text-gray-500">
              Saída
              <input inputMode="decimal" value={priceOut} onChange={(e) => setPriceOut(e.target.value)} className={cn(inputCls, "mt-1")} />
            </label>
          </div>
          <p className="mt-1.5 text-[11px] text-gray-400">Usado só para calcular o custo no painel. Confira os valores em openai.com/api/pricing.</p>
        </section>
      </fieldset>

      <div className="flex shrink-0 items-center gap-2 border-t border-gray-100 bg-white p-3">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        {canEdit && (
          <Button onClick={save} disabled={!valid || saving} className="flex-1">
            {saving ? "Salvando…" : "Salvar ajustes"}
          </Button>
        )}
      </div>
    </div>
  );
}
