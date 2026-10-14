"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";
import { CHANGELOG, type ChangelogEntry, type ChangelogTag } from "@/lib/changelog";
import { formatDate } from "@/lib/utils";

export const TAG_LABEL: Record<ChangelogTag, string> = { novo: "Novo", melhoria: "Melhoria", correção: "Correção" };
export const TAG_TONE: Record<ChangelogTag, "success" | "info" | "accent"> = { novo: "success", melhoria: "info", correção: "accent" };

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function monthLabel(date: string) {
  const [y, m] = date.split("-").map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

export function UpdatesPageClient() {
  const [open, setOpen] = useState<ChangelogEntry | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, ChangelogEntry[]>();
    for (const e of CHANGELOG) {
      const key = monthLabel(e.date);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()];
  }, []);

  return (
    <div>
      <PageHeader
        icon={Sparkles}
        title="Atualizações"
        description="Tudo que já mudou no Hub desde a criação. Clique em um cartão para ver os detalhes."
      />

      <div className="space-y-8">
        {groups.map(([month, entries]) => (
          <section key={month}>
            <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold capitalize text-blue-900">
              <CalendarDays className="h-4 w-4 text-yellow-600" /> {month}
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">{entries.length}</span>
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {entries.map((e, i) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(e)}
                    style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                    className="kb-card-in group flex h-full w-full flex-col gap-2.5 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:border-yellow-500 hover:shadow-[var(--shadow-md)]"
                  >
                    <div className="flex items-center gap-2">
                      <Badge tone={TAG_TONE[e.tag]}>{TAG_LABEL[e.tag]}</Badge>
                      <span className="truncate text-[11px] font-bold uppercase tracking-wide text-gray-500">{e.area}</span>
                      <span className="ml-auto shrink-0 text-xs text-gray-400">{formatDate(e.date)}</span>
                    </div>
                    <h3 className="font-display text-[15px] font-bold leading-snug text-blue-900">{e.title}</h3>
                    <p className="text-sm leading-relaxed text-gray-600">{e.summary}</p>
                    <span className="mt-auto flex items-center gap-1 pt-1 text-xs font-bold text-blue-800 group-hover:text-blue-900">
                      Ver detalhes <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <Dialog open={!!open} onClose={() => setOpen(null)} size="lg">
        {open && (
          <>
            <DialogHeader title={open.title} subtitle={`${open.area} · ${formatDate(open.date)}`} onClose={() => setOpen(null)} />
            <DialogBody className="space-y-4">
              <Badge tone={TAG_TONE[open.tag]}>{TAG_LABEL[open.tag]}</Badge>
              <p className="text-sm font-semibold leading-relaxed text-blue-900">{open.summary}</p>
              <ul className="space-y-2.5">
                {open.details.map((d, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-gray-700">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </DialogBody>
          </>
        )}
      </Dialog>
    </div>
  );
}
