"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterBar, FilterSelect } from "@/components/ui/FilterBar";
import { RightDrawer } from "@/components/shared/RightDrawer";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { listPlanMonths, listPlanPosts, listPlanStories, savePlanPost } from "@/lib/services/contentPlan";
import {
  ACCOUNT_COLOR, ACCOUNT_SHORT, MONTH_NAMES, addDays, fmtDayMonth, fromKey, monthKey, openPendingCount, pad, startOfWeek, toKey, todayKey,
} from "@/lib/contentPlan";
import { cn } from "@/lib/utils";
import type { ContentPlanMonth, ContentPlanPost, ContentPlanStory, PlanAccount } from "@/types/database";
import { YearView } from "./YearView";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import { PlanList } from "./PlanList";
import { PostDrawer } from "./PostDrawer";
import { PendingPanel } from "./PendingPanel";
import { toast } from "sonner";

type View = "ano" | "mes" | "semana" | "dia" | "lista";
const VIEWS: { value: View; label: string }[] = [
  { value: "ano", label: "Ano" },
  { value: "mes", label: "Mês" },
  { value: "semana", label: "Semana" },
  { value: "dia", label: "Dia" },
  { value: "lista", label: "Lista" },
];
const parseView = (v: string | null): View => (VIEWS.some((x) => x.value === v) ? (v as View) : "mes");
const parseAccount = (v: string | null): PlanAccount | "" => (v === "franchising" || v === "roberson" ? v : "");

function rangeFor(view: View, cursor: Date) {
  if (view === "ano") return { from: `${cursor.getFullYear()}-01-01`, to: `${cursor.getFullYear()}-12-31` };
  if (view === "semana") {
    const s = startOfWeek(cursor);
    return { from: toKey(s), to: toKey(addDays(s, 6)) };
  }
  if (view === "dia") return { from: toKey(cursor), to: toKey(cursor) };
  // mês e lista: a grade do mês inclui os dias vizinhos
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  if (view === "lista") return { from: toKey(first), to: toKey(last) };
  return { from: toKey(startOfWeek(first)), to: toKey(addDays(startOfWeek(last), 6)) };
}

function titleFor(view: View, cursor: Date) {
  const month = MONTH_NAMES[cursor.getMonth()];
  if (view === "ano") return String(cursor.getFullYear());
  if (view === "mes" || view === "lista") return `${month} de ${cursor.getFullYear()}`;
  if (view === "dia") {
    const wd = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][cursor.getDay()];
    return `${wd}, ${cursor.getDate()} de ${month.toLowerCase()}`;
  }
  const s = startOfWeek(cursor);
  const e = addDays(s, 6);
  return `${pad(s.getDate())}/${pad(s.getMonth() + 1)} a ${pad(e.getDate())}/${pad(e.getMonth() + 1)} de ${e.getFullYear()}`;
}

function shift(view: View, cursor: Date, dir: -1 | 1) {
  if (view === "ano") return new Date(cursor.getFullYear() + dir, 0, 1);
  if (view === "mes" || view === "lista") return new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);
  return addDays(cursor, (view === "semana" ? 7 : 1) * dir);
}

/**
 * Planejamento de conteúdo dos dois perfis do Instagram: Ano, Mês, Semana, Dia e Lista.
 * Cada post carrega o cronograma (pilar, tema, objetivo, funil), o roteiro em blocos e as pendências antes de gravar.
 */
export function PlanningWorkspace() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = parseView(searchParams.get("ver"));
  const account = parseAccount(searchParams.get("perfil"));
  const dataParam = searchParams.get("data");
  const cursor = useMemo(() => (dataParam && /^\d{4}-\d{2}-\d{2}$/.test(dataParam) ? fromKey(dataParam) : new Date()), [dataParam]);

  const [posts, setPosts] = useState<ContentPlanPost[]>([]);
  const [stories, setStories] = useState<ContentPlanStory[]>([]);
  const [months, setMonths] = useState<ContentPlanMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [funnel, setFunnel] = useState("");
  const [format, setFormat] = useState("");
  const [status, setStatus] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [editor, setEditor] = useState<{ post: ContentPlanPost | null; account: PlanAccount; date: string } | null>(null);

  const { from, to } = useMemo(() => rangeFor(view, cursor), [view, cursor]);
  const monthsFrom = view === "ano" ? `${cursor.getFullYear()}-01-01` : monthKey(cursor);
  const monthsTo = view === "ano" ? `${cursor.getFullYear()}-12-01` : monthKey(cursor);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [p, s, m] = await Promise.all([
          listPlanPosts(supabase, from, to, account),
          view === "ano" || view === "lista" ? Promise.resolve([] as ContentPlanStory[]) : listPlanStories(supabase, from, to, account),
          listPlanMonths(supabase, monthsFrom, monthsTo, account),
        ]);
        setPosts(p);
        setStories(s);
        setMonths(m);
      } catch (e) {
        console.error(e);
        toast.error("Não foi possível carregar o planejamento.");
      } finally {
        setLoading(false);
      }
    },
    [supabase, from, to, account, view, monthsFrom, monthsTo]
  );

  useEffect(() => {
    void load();
  }, [load]);
  useRealtimeChanges(["content_plan_posts", "content_plan_stories"], () => load(true));

  function navigate(next: { ver?: View; perfil?: PlanAccount | ""; data?: Date }) {
    const params = new URLSearchParams(searchParams.toString());
    const set = (key: string, value: string | null) => (value ? params.set(key, value) : params.delete(key));
    const ver = next.ver ?? view;
    set("ver", ver === "mes" ? null : ver);
    set("perfil", (next.perfil ?? account) || null);
    const date = next.data ?? cursor;
    set("data", toKey(date) === todayKey() ? null : toKey(date));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter(
      (p) =>
        (!q || [p.theme, p.pillar, p.objective, p.trigger].some((t) => t?.toLowerCase().includes(q))) &&
        (!funnel || p.funnel === funnel) &&
        (!format || p.format === format) &&
        (!status || p.status === status) &&
        (!onlyPending || openPendingCount(p) > 0)
    );
  }, [posts, search, funnel, format, status, onlyPending]);

  async function togglePending(post: ContentPlanPost, index: number) {
    const pending = post.pending.map((x, i) => (i === index ? { ...x, done: !x.done } : x));
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, pending } : p)));
    try {
      await savePlanPost(supabase, { id: post.id, pending });
    } catch {
      toast.error("Não foi possível atualizar a pendência.");
      void load(true);
    }
  }

  const defaultAccount: PlanAccount = account || "roberson";
  const openNew = (date?: string) => setEditor({ post: null, account: defaultAccount, date: date ?? (view === "dia" ? toKey(cursor) : todayKey()) });
  const openPost = (p: ContentPlanPost) => setEditor({ post: p, account: p.account, date: p.publish_date });
  const closeEditor = useCallback(() => setEditor(null), []);
  const filtersActive = !!(search || funnel || format || status || onlyPending);
  const openPendings = filtered.reduce((n, p) => n + openPendingCount(p), 0);

  return (
    <div>
      {/* Navegação: período, visão e perfil */}
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => navigate({ data: shift(view, cursor, -1) })} aria-label="Período anterior" className="rounded-full border border-gray-200 bg-white p-1.5 text-blue-900 hover:bg-gray-050"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => navigate({ data: new Date() })} className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-900 hover:bg-gray-050">Hoje</button>
          <button type="button" onClick={() => navigate({ data: shift(view, cursor, 1) })} aria-label="Próximo período" className="rounded-full border border-gray-200 bg-white p-1.5 text-blue-900 hover:bg-gray-050"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <h2 className="font-display text-[17px] font-bold capitalize text-blue-900">{titleFor(view, cursor)}</h2>

        <div role="tablist" aria-label="Visão do planejamento" className="inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-[var(--shadow-sm)] sm:ml-auto">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              role="tab"
              aria-selected={view === v.value}
              onClick={() => navigate({ ver: v.value })}
              className={cn("rounded-full px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95", view === v.value ? "bg-blue-900 text-white shadow-sm" : "text-gray-600 hover:bg-gray-050")}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {([["", "Os dois perfis"], ["franchising", "@helpmultasfranchising"], ["roberson", "@roberson.alvarenga"]] as const).map(([value, label]) => {
          const active = account === value;
          const color = value ? ACCOUNT_COLOR[value] : "#243746";
          return (
            <button
              key={value || "todos"}
              type="button"
              aria-pressed={active}
              onClick={() => navigate({ perfil: value })}
              className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors", active ? "text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200")}
              style={active ? { backgroundColor: color } : undefined}
            >
              {label}
            </button>
          );
        })}
        <Button onClick={() => openNew()} className="ml-auto gap-1.5"><Plus className="h-4 w-4" /> Novo post</Button>
      </div>

      <FilterBar
        summary={
          filtersActive || posts.length > 0
            ? `${filtered.length} ${filtered.length === 1 ? "post" : "posts"}${openPendings ? ` · ${openPendings} pendência${openPendings > 1 ? "s" : ""} em aberto` : ""}`
            : undefined
        }
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar tema, pilar ou objetivo…" />
        <FilterSelect label="Formato" value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="">Todo formato</option>
          <option value="reels">Reels</option>
          <option value="carrossel">Carrossel</option>
          <option value="feed">Feed</option>
        </FilterSelect>
        <FilterSelect label="Funil" value={funnel} onChange={(e) => setFunnel(e.target.value)}>
          <option value="">Todo o funil</option>
          <option value="topo">Topo</option>
          <option value="meio">Meio</option>
          <option value="fundo">Fundo</option>
        </FilterSelect>
        <FilterSelect label="Etapa" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Toda etapa</option>
          <option value="planejado">Planejado</option>
          <option value="roteirizado">Roteiro pronto</option>
          <option value="gravado">Gravado</option>
          <option value="publicado">Publicado</option>
        </FilterSelect>
        <button
          type="button"
          aria-pressed={onlyPending}
          onClick={() => setOnlyPending((v) => !v)}
          className={cn("h-10 rounded-full px-3.5 text-sm font-semibold transition-colors", onlyPending ? "bg-[color:var(--color-danger)] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200")}
        >
          Com pendências
        </button>
      </FilterBar>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3" role="status" aria-label="Carregando planejamento">
          {[0, 1, 2].map((i) => <div key={i} className="ast-skeleton h-48 rounded-2xl" style={{ animationDelay: `${i * 120}ms` }} />)}
        </div>
      ) : view === "ano" ? (
        <YearView year={cursor.getFullYear()} posts={filtered} account={account} onOpenMonth={(m) => navigate({ ver: "mes", data: new Date(cursor.getFullYear(), m, 1) })} />
      ) : view === "mes" ? (
        <MonthView
          cursor={cursor}
          posts={filtered}
          stories={stories}
          months={months}
          account={account}
          onOpenPost={openPost}
          onNewPost={openNew}
          onOpenDay={(d) => navigate({ ver: "dia", data: fromKey(d) })}
          onTogglePending={togglePending}
          onMonthSaved={() => load(true)}
        />
      ) : view === "semana" ? (
        <div className="space-y-4">
          <WeekView cursor={cursor} posts={filtered} stories={stories} account={account} onOpenPost={openPost} onNewPost={openNew} onOpenDay={(d) => navigate({ ver: "dia", data: fromKey(d) })} />
          <PendingPanel posts={filtered} onOpenPost={openPost} onToggle={togglePending} title={`Pendências da semana (${fmtDayMonth(from)} a ${fmtDayMonth(to)})`} />
        </div>
      ) : view === "dia" ? (
        <DayView cursor={cursor} posts={filtered} stories={stories} account={account} onEditPost={openPost} onNewPost={openNew} onStoriesChanged={() => load(true)} />
      ) : (
        <PlanList posts={filtered} showAccount={!account} onOpenPost={openPost} onNewPost={() => openNew()} />
      )}

      <RightDrawer open={!!editor} onClose={closeEditor} label="Editar post do planejamento" wide>
        {editor && (
          <PostDrawer
            key={editor.post?.id ?? `new-${editor.date}-${editor.account}`}
            post={editor.post}
            defaults={{ account: editor.account, date: editor.date }}
            onClose={closeEditor}
            onSaved={() => load(true)}
          />
        )}
      </RightDrawer>
    </div>
  );
}

export { ACCOUNT_SHORT };
