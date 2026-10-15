"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { Chip } from "@/components/shared/dash-parts";
import { cn } from "@/lib/utils";
import type { DuplicateGroup, IssueLead } from "@/lib/lead-reconciliation";
import { ExportButtons, LEAD_COLUMNS, SOURCE_LABEL, SourceBadge, ageLabel, fmtDateTime, leadRow, type Run } from "./shared";

const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const matches = (l: IssueLead, q: string) => !q || norm([l.name, l.phone, l.email, l.origin].join(" ")).includes(norm(q));

function Toolbar({
  search,
  setSearch,
  source,
  setSource,
  sources,
  right,
}: {
  search: string;
  setSearch: (v: string) => void;
  source: string;
  setSource: (v: string) => void;
  sources: IssueLead["source"][];
  right: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar nome, telefone, e-mail, anúncio…" className="w-full sm:w-72" />
        <Chip active={source === "all"} onClick={() => setSource("all")}>Todos</Chip>
        {sources.map((s) => (
          <Chip key={s} active={source === s} onClick={() => setSource(s)}>
            {SOURCE_LABEL[s]}
          </Chip>
        ))}
      </div>
      {right}
    </div>
  );
}

/** Lista "Fora do CRM" ou "Aguardando". */
export function ReconLeadList({
  leads,
  kind,
  run,
  onOpen,
}: {
  leads: IssueLead[];
  kind: "missing" | "pending";
  run: Run;
  onOpen: (l: IssueLead) => void;
}) {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const filtered = useMemo(() => leads.filter((l) => (source === "all" || l.source === source) && matches(l, search)), [leads, source, search]);
  const title = kind === "missing" ? "Leads fora do CRM" : "Leads aguardando o CRM";

  return (
    <div>
      <Toolbar
        search={search}
        setSearch={setSearch}
        source={source}
        setSource={setSource}
        sources={["lp", "nativo"]}
        right={
          <ExportButtons
            disabled={!filtered.length}
            build={() => ({
              title,
              fileBase: kind === "missing" ? "leads-fora-do-crm" : "leads-aguardando-crm",
              filters: [
                ["Ciclo", fmtDateTime(run.started_at)],
                ["Janela", "últimos 7 dias"],
                ["Origem", source === "all" ? "Todas" : SOURCE_LABEL[source as IssueLead["source"]]],
                ...(search ? ([["Busca", search]] as [string, string][]) : []),
              ],
              columns: LEAD_COLUMNS,
              rows: filtered.map(leadRow),
            })}
          />
        }
      />
      <div className="overflow-x-auto rounded-2xl border border-gray-100">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-gray-050 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              {["Origem", "Nome", "Telefone", "E-mail", "Página / anúncio", "Recebido", kind === "missing" ? "Fora há" : "Chegou há", ""].map((h) => (
                <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((l) => (
              <tr key={`${l.source}-${l.id}`} onClick={() => onOpen(l)} className="group cursor-pointer transition-colors hover:bg-yellow-50/60">
                <td className="px-3 py-2.5"><SourceBadge source={l.source} /></td>
                <td className="px-3 py-2.5 font-semibold text-blue-900">{l.name || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{l.phone || "—"}</td>
                <td className="px-3 py-2.5">{l.email || "—"}</td>
                <td className="max-w-[280px] truncate px-3 py-2.5 text-gray-600" title={l.origin}>{l.origin || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">{fmtDateTime(l.at)}</td>
                <td className={cn("whitespace-nowrap px-3 py-2.5 text-xs font-semibold", kind === "missing" ? "text-[color:var(--color-danger)]" : "text-yellow-700")}>{ageLabel(l.at)}</td>
                <td className="px-2 py-2.5 text-gray-300 group-hover:text-blue-900"><ChevronRight className="h-4 w-4" /></td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center text-gray-500">
                  {leads.length ? "Nenhum lead com esse filtro." : kind === "missing" ? "Nenhum lead fora do CRM 🎉" : "Nenhum lead aguardando."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-500">{filtered.length} de {leads.length} leads · clique numa linha para ver os detalhes.</p>
    </div>
  );
}

const DUP_LABEL: Record<DuplicateGroup["source"], string> = {
  lp: "Cadastrou mais de uma vez na LP",
  nativo: "Preencheu o formulário nativo mais de uma vez",
  crm: "Mesmo contato com ids de CRM diferentes",
};

export function ReconDuplicates({ groups, run, onOpen }: { groups: DuplicateGroup[]; run: Run; onOpen: (l: IssueLead, g: DuplicateGroup) => void }) {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const filtered = useMemo(
    () => groups.filter((g) => (source === "all" || g.source === source) && g.leads.some((l) => matches(l, search))),
    [groups, source, search],
  );

  return (
    <div>
      <Toolbar
        search={search}
        setSearch={setSearch}
        source={source}
        setSource={setSource}
        sources={["lp", "nativo", "crm"]}
        right={
          <ExportButtons
            disabled={!filtered.length}
            build={() => ({
              title: "Leads duplicados",
              fileBase: "leads-duplicados",
              filters: [
                ["Ciclo", fmtDateTime(run.started_at)],
                ["Grupos", String(filtered.length)],
                ["Onde", source === "all" ? "LP, nativo e CRM" : SOURCE_LABEL[source as IssueLead["source"]]],
              ],
              columns: ["Grupo", "Onde", "Nome", "Telefone", "E-mail", "Id CRM", "Etapa CRM", "Recebido em"],
              rows: filtered.flatMap((g, gi) =>
                g.leads.map((l) => [`#${gi + 1}`, SOURCE_LABEL[g.source], l.name || "—", l.phone || "—", l.email || "—", l.crm_lead_id || "—", l.crm_stage || "—", fmtDateTime(l.at)]),
              ),
            })}
          />
        }
      />
      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.map((g, gi) => (
          <div key={`${g.source}-${g.key}-${gi}`} className="rounded-2xl border border-gray-100 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SourceBadge source={g.source} />
                <span className="text-xs text-gray-500">{DUP_LABEL[g.source]}</span>
              </div>
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">{g.leads.length}x</span>
            </div>
            <ul className="divide-y divide-gray-100">
              {g.leads.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => onOpen(l, g)} className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-2 text-left hover:bg-gray-050">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-blue-900">{l.name || "Sem nome"}</span>
                      <span className="block truncate text-xs text-gray-500">{[l.phone, l.email].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-gray-500">
                      {l.crm_stage && <span className="block font-semibold text-blue-900">{l.crm_stage}</span>}
                      {fmtDateTime(l.at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!filtered.length && <p className="col-span-full py-12 text-center text-sm text-gray-500">Nenhum duplicado.</p>}
      </div>
    </div>
  );
}

export function ReconHistory({ runs, selected, onSelect }: { runs: Run[]; selected: string | undefined; onSelect: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-gray-050 text-xs uppercase tracking-wide text-gray-500">
          <tr>{["Ciclo", "Status", "Leads", "LP fora", "Nativo fora", "Aguardando", "Duplicados", "Duração"].map((h) => <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {runs.map((r) => {
            const s = r.summary;
            const secs = r.finished_at ? Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000) : null;
            return (
              <tr key={r.id} onClick={() => onSelect(r.id)} className={cn("cursor-pointer hover:bg-yellow-50/60", r.id === selected && "bg-yellow-50")}>
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-blue-900">{fmtDateTime(r.started_at)}</td>
                <td className="px-3 py-2.5">
                  {r.status === "success" ? <span className="text-xs font-bold text-[color:var(--color-success)]">OK</span> : r.status === "error" ? <span className="text-xs font-bold text-[color:var(--color-danger)]" title={r.error ?? ""}>Erro</span> : <span className="text-xs text-gray-500">Rodando</span>}
                  {s.native_error && <span className="ml-1 text-xs text-yellow-700" title={s.native_error}>· nativo falhou</span>}
                </td>
                <td className="px-3 py-2.5">{(s.lp_total ?? 0) + (s.native_total ?? 0)}</td>
                <td className="px-3 py-2.5">{s.lp_missing ?? "—"}</td>
                <td className="px-3 py-2.5">{s.native_missing ?? "—"}</td>
                <td className="px-3 py-2.5">{(s.lp_pending ?? 0) + (s.native_pending ?? 0)}</td>
                <td className="px-3 py-2.5">{(s.dup_lp ?? 0) + (s.dup_native ?? 0) + (s.dup_crm ?? 0)}</td>
                <td className="px-3 py-2.5 text-gray-500">{secs != null ? `${secs}s` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
