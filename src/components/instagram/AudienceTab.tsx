"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import {
  BRAND, BarList, ChartTooltip, Donut, GRID_COLOR, Insight, Kpi, Panel, RTooltip, TICK_STYLE, compact, fmt, percent,
} from "@/components/shared/dash-parts";
import { Globe2, MapPin, Users, VenetianMask } from "lucide-react";
import type { InstagramAudienceRow } from "@/types/database";

type Entry = { key: string; value: number };

const AGE_ORDER = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const GENDER_LABEL: Record<string, { label: string; color: string }> = {
  F: { label: "Feminino", color: "#e0556b" },
  M: { label: "Masculino", color: BRAND.blue },
  U: { label: "Não informado", color: "#9aa7af" },
};

function entries(rows: InstagramAudienceRow[], kind: InstagramAudienceRow["kind"]): Entry[] {
  const row = rows.find((r) => r.kind === kind);
  return Array.isArray(row?.data) ? (row.data as Entry[]) : [];
}

const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["pt-BR"], { type: "region" }) : null;

function countryName(code: string) {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

export function AudienceTab({ audience, followersNow }: { audience: InstagramAudienceRow[]; followersNow: number | null }) {
  const age = useMemo(() => {
    const raw = entries(audience, "age");
    return AGE_ORDER.map((k) => ({ label: k, value: raw.find((e) => e.key === k)?.value ?? 0 }));
  }, [audience]);
  const gender = entries(audience, "gender");
  const cities = entries(audience, "city");
  const countries = entries(audience, "country");

  const total = gender.reduce((s, e) => s + e.value, 0) || age.reduce((s, e) => s + e.value, 0);

  if (!gender.length && !age.some((a) => a.value) && !cities.length && !countries.length) {
    return (
      <Card className="p-10 text-center text-sm text-gray-500">
        Sem dados de público ainda. A Meta só libera idade, gênero e localização para perfis com 100+ seguidores —
        clique em “Atualizar agora” para buscar.
      </Card>
    );
  }

  const topAge = [...age].sort((a, b) => b.value - a.value)[0];
  const topGender = [...gender].sort((a, b) => b.value - a.value)[0];
  const topCity = cities[0];
  const topCountry = countries[0];
  const syncedAt = audience.reduce((max, r) => (r.synced_at > max ? r.synced_at : max), "");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Seguidores" icon={Users} value={followersNow != null ? fmt(followersNow) : total ? fmt(total) : "—"} />
        <Kpi
          label="Faixa etária principal" icon={VenetianMask} value={topAge?.value ? topAge.label : "—"}
          hint={topAge?.value ? `${percent(topAge.value, total, 0)} dos seguidores` : undefined}
        />
        <Kpi
          label="Gênero predominante" value={topGender ? (GENDER_LABEL[topGender.key]?.label ?? topGender.key) : "—"}
          hint={topGender ? `${percent(topGender.value, total, 0)} dos seguidores` : undefined}
        />
        <Kpi
          label="Principal cidade" icon={MapPin} value={topCity ? topCity.key.split(",")[0] : "—"}
          hint={topCity ? `${percent(topCity.value, total, 1)} dos seguidores` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Gênero" subtitle="Seguidores por gênero">
          <Donut
            data={gender.map((g) => ({
              name: GENDER_LABEL[g.key]?.label ?? g.key,
              value: g.value,
              color: GENDER_LABEL[g.key]?.color ?? "#9aa7af",
            }))}
            centerLabel="seguidores"
            centerValue={compact(total)}
          />
        </Panel>
        <Panel title="Faixa etária" subtitle="Seguidores por idade">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={age} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={compact} />
              <RTooltip content={<ChartTooltip />} cursor={{ fill: "#f4f6f8" }} />
              <Bar isAnimationActive={false} dataKey="value" name="Seguidores" radius={[6, 6, 0, 0]}>
                {age.map((a) => (
                  <Cell key={a.label} fill={a.label === topAge?.label ? BRAND.yellow : BRAND.blue} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Principais cidades" subtitle="Top 10 por seguidores">
          <BarList items={cities.slice(0, 10).map((c) => ({ label: c.key, value: c.value }))} total={total} />
        </Panel>
        <Panel title="Principais países" subtitle="Top 8 por seguidores">
          <BarList
            items={countries.slice(0, 8).map((c) => ({ label: countryName(c.key), value: c.value }))}
            total={total}
            color={BRAND.steel}
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {topCity && (
          <Insight icon={MapPin} title={`Praça principal: ${topCity.key}`}>
            Concentra {percent(topCity.value, total, 1)} da base. Bom alvo para conteúdo local e prova social regional.
          </Insight>
        )}
        {topCountry && (
          <Insight icon={Globe2} title={`${countryName(topCountry.key)} lidera os países`}>
            {percent(topCountry.value, total, 0)} dos seguidores estão lá.
          </Insight>
        )}
      </div>
      {syncedAt && (
        <p className="text-center text-[11px] text-gray-400">
          Dados de público atualizados em {new Date(syncedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.
        </p>
      )}
    </div>
  );
}
