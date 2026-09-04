"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { createClient } from "@/lib/supabase/client";
import {
  createProjectCreative,
  deleteProjectCreative,
  listProjectCreatives,
  updateProjectCreative,
} from "@/lib/services/creatives";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import type { Profile, ProjectCreative } from "@/types/database";

const TEXT_FIELDS = ["name", "unit", "link"] as const;
type TextField = (typeof TEXT_FIELDS)[number];

export function CreativesTable({ projectId, profiles }: { projectId: string; profiles: Profile[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState<ProjectCreative[]>([]);
  const editingCell = useRef<string | null>(null); // `${rowId}:${field}` currently being typed into
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  async function load() {
    const data = await listProjectCreatives(supabase, projectId);
    setRows((prev) =>
      data.map((row) => {
        const local = prev.find((p) => p.id === row.id);
        if (!local) return row;
        const merged = { ...row };
        for (const field of TEXT_FIELDS) {
          if (editingCell.current === `${row.id}:${field}`) (merged as ProjectCreative)[field] = local[field];
        }
        return merged;
      })
    );
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useRealtimeChanges(["project_creatives"], load, {
    filters: { project_creatives: `project_id=eq.${projectId}` },
  });

  function handleTextChange(rowId: string, field: TextField, value: string) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)));

    const key = `${rowId}:${field}`;
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => {
      updateProjectCreative(supabase, rowId, { [field]: value }).catch(() => {});
    }, 500);
  }

  async function handleFieldSave(rowId: string, patch: Partial<ProjectCreative>) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
    await updateProjectCreative(supabase, rowId, patch).catch(() => {});
  }

  async function addRow() {
    const created = await createProjectCreative(supabase, {
      project_id: projectId,
      sort_order: rows.length,
    });
    setRows((prev) => [...prev, created]);
  }

  async function removeRow(rowId: string) {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    await deleteProjectCreative(supabase, rowId).catch(() => {});
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-blue-900">Criativos</h3>
        <Button size="sm" variant="secondary" onClick={addRow} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nova linha
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-050 text-left text-xs font-bold uppercase text-gray-500">
              <th className="px-3 py-2.5">Nome</th>
              <th className="px-3 py-2.5">Unidade</th>
              <th className="px-3 py-2.5">Nome de quem entregou</th>
              <th className="px-3 py-2.5">Data de entrega do arquivo</th>
              <th className="px-3 py-2.5">Link de criativos</th>
              <th className="w-10 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 last:border-0">
                <EditableCell
                  value={row.name}
                  onChange={(v) => handleTextChange(row.id, "name", v)}
                  onFocus={() => (editingCell.current = `${row.id}:name`)}
                  onBlur={() => (editingCell.current = null)}
                  placeholder="Nome do criativo"
                />
                <EditableCell
                  value={row.unit}
                  onChange={(v) => handleTextChange(row.id, "unit", v)}
                  onFocus={() => (editingCell.current = `${row.id}:unit`)}
                  onBlur={() => (editingCell.current = null)}
                  placeholder="Unidade"
                />
                <td className="px-2 py-1.5">
                  <Select
                    className="h-9"
                    value={row.delivered_by ?? ""}
                    onChange={(e) => handleFieldSave(row.id, { delivered_by: e.target.value || null })}
                  >
                    <option value="">Selecionar...</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="date"
                    value={row.delivered_at ?? ""}
                    onChange={(e) => handleFieldSave(row.id, { delivered_at: e.target.value || null })}
                    className="h-9 w-full rounded-[10px] border border-gray-200 bg-white px-2.5 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  />
                </td>
                <EditableCell
                  value={row.link}
                  onChange={(v) => handleTextChange(row.id, "link", v)}
                  onFocus={() => (editingCell.current = `${row.id}:link`)}
                  onBlur={() => (editingCell.current = null)}
                  placeholder="https://..."
                />
                <td className="px-2 py-1.5 text-center">
                  <button
                    onClick={() => removeRow(row.id)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-[color:var(--color-danger)]"
                    aria-label="Remover linha"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-sm text-gray-400">
                  Nenhum criativo cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditableCell({
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  placeholder?: string;
}) {
  return (
    <td className="px-2 py-1.5">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        className="h-9 w-full rounded-[10px] border border-transparent bg-transparent px-2.5 text-sm text-blue-900 placeholder:text-gray-400 hover:border-gray-200 focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
      />
    </td>
  );
}
