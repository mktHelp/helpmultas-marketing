"use client";

import { Checkbox } from "@/components/ui/Checkbox";
import { allTabKeys, tabGroupsForRole } from "@/lib/access";

/**
 * Seletor das abas liberadas. `value` null = acesso padrão (todas). Ao marcar
 * tudo volta para null, assim abas novas criadas no futuro continuam liberadas.
 */
export function TabAccessPicker({ role, value, onChange }: { role: string; value: string[] | null; onChange: (v: string[] | null) => void }) {
  const groups = tabGroupsForRole(role);
  if (role === "master") {
    return <p className="rounded-xl bg-blue-050 px-3 py-2 text-xs text-blue-800">O Master sempre tem acesso a todas as abas.</p>;
  }
  const all = allTabKeys(groups);
  const selected = new Set(value ?? all);

  function commit(next: Set<string>) {
    onChange(all.every((k) => next.has(k)) ? null : all.filter((k) => next.has(k)));
  }
  function toggle(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    commit(next);
  }
  function toggleGroup(keys: string[]) {
    const next = new Set(selected);
    const everyOn = keys.every((k) => next.has(k));
    keys.forEach((k) => (everyOn ? next.delete(k) : next.add(k)));
    commit(next);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">{selected.size} de {all.length} abas liberadas</span>
        <div className="flex gap-3 text-xs font-semibold text-blue-800">
          <button type="button" onClick={() => onChange(null)} className="hover:underline">Marcar todas</button>
          <button type="button" onClick={() => onChange([])} className="hover:underline">Limpar</button>
        </div>
      </div>
      <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-gray-200 p-3">
        {groups.map((g) => {
          const keys = g.tabs.map((t) => t.key);
          const everyOn = keys.every((k) => selected.has(k));
          return (
            <div key={g.title}>
              <button type="button" onClick={() => toggleGroup(keys)} className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-gray-500 hover:text-blue-900">
                <span className={everyOn ? "text-yellow-600" : ""}>{g.title}</span>
                <span className="font-normal normal-case">({everyOn ? "desmarcar grupo" : "marcar grupo"})</span>
              </button>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {g.tabs.map((t) => (
                  <label key={t.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-sm text-blue-900 hover:bg-gray-050">
                    <Checkbox checked={selected.has(t.key)} onChange={() => toggle(t.key)} />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
