"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ListTodo, FolderKanban, Megaphone, Users as UsersIcon, CornerDownLeft, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { pathAllowed } from "@/lib/access";
import { NAV_SECTIONS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface Result {
  type: "page" | "task" | "project" | "campaign" | "user";
  id: string;
  label: string;
  sublabel?: string;
  icon?: LucideIcon;
}

const ICONS: Record<Exclude<Result["type"], "page">, LucideIcon> = { task: ListTodo, project: FolderKanban, campaign: Megaphone, user: UsersIcon };
const GROUP_LABEL: Record<Result["type"], string> = { page: "Ir para", task: "Tarefas", project: "Projetos", campaign: "Campanhas", user: "Pessoas" };

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Busca global (Ctrl+K): primeiro as páginas do menu (navegação rápida), depois tarefas,
// projetos, campanhas e pessoas. Setas ↑↓ escolhem, Enter abre, Esc fecha.
export function GlobalSearch({ autoFocus, onNavigate }: { autoFocus?: boolean; onNavigate?: () => void } = {}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();
  const { profile } = useAuth();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        ref.current?.querySelector("input")?.focus();
        setOpen(true);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const pages = useMemo<Result[]>(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return NAV_SECTIONS.flatMap((s) =>
      s.items
        .filter((i) => pathAllowed(profile, i.href) && (normalize(i.label).includes(q) || normalize(s.title).includes(q)))
        .map((i) => ({ type: "page" as const, id: i.href, label: i.label, sublabel: s.title, icon: i.icon }))
    ).slice(0, 5);
  }, [query, profile]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const [tasks, projects, campaigns, users] = await Promise.all([
        supabase.from("tasks").select("id, title, status").ilike("title", `%${query}%`).limit(5),
        supabase.from("projects").select("id, name").ilike("name", `%${query}%`).limit(3),
        supabase.from("campaigns").select("id, name").ilike("name", `%${query}%`).limit(3),
        supabase.from("profiles").select("id, full_name, job_title").neq("role", "expansao").ilike("full_name", `%${query}%`).limit(3),
      ]);

      const r: Result[] = [
        ...(tasks.data || []).map((t) => ({ type: "task" as const, id: t.id, label: t.title, sublabel: t.status })),
        ...(projects.data || []).map((p) => ({ type: "project" as const, id: p.id, label: p.name })),
        ...(campaigns.data || []).map((c) => ({ type: "campaign" as const, id: c.id, label: c.name })),
        ...(users.data || []).map((u) => ({ type: "user" as const, id: u.id, label: u.full_name, sublabel: u.job_title })),
      ];
      setResults(r);
    }, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const all = useMemo(() => [...pages, ...results], [pages, results]);

  function go(r: Result) {
    setOpen(false);
    setQuery("");
    setCursor(0);
    onNavigate?.();
    if (r.type === "page") {
      router.push(r.id);
      return;
    }
    const routes = { task: `/tasks/${r.id}`, project: `/projects/${r.id}`, campaign: `/campaigns/${r.id}`, user: `/team/${r.id}` };
    router.push(routes[r.type]);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      (e.target as HTMLInputElement).blur();
      return;
    }
    if (!all.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % all.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + all.length) % all.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(all[Math.min(cursor, all.length - 1)]);
    }
  }

  return (
    <div className="relative w-full max-w-md" ref={ref}>
      <div className="flex h-9 items-center gap-2 rounded-[10px] border border-gray-200 bg-white px-3 transition-shadow focus-within:border-yellow-500 focus-within:shadow-[var(--shadow-focus)]">
        <Search className="h-4 w-4 shrink-0 text-gray-500" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKey}
          autoFocus={autoFocus}
          placeholder="Buscar páginas, tarefas, projetos, pessoas..."
          aria-label="Buscar"
          className="w-full bg-transparent text-[13px] text-blue-900 placeholder:text-gray-500 focus:outline-none"
        />
        <kbd className="hidden shrink-0 rounded-md border border-gray-200 bg-gray-050 px-1.5 py-0.5 font-sans text-[10px] font-bold text-gray-500 md:block">Ctrl K</kbd>
      </div>

      {open && all.length > 0 && (
        <div className="dd-pop absolute left-0 right-0 z-30 mt-1.5 max-h-[420px] overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-[var(--shadow-lg)]">
          {all.map((r, i) => {
            const Icon = r.icon ?? ICONS[r.type as Exclude<Result["type"], "page">];
            const header = i === 0 || all[i - 1].type !== r.type;
            return (
              <div key={`${r.type}-${r.id}`}>
                {header && <p className="px-2.5 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-wider text-gray-400">{GROUP_LABEL[r.type]}</p>}
                <button
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(r)}
                  className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px]", cursor === i ? "bg-gray-100" : "hover:bg-gray-050")}
                >
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", r.type === "page" ? "bg-yellow-100 text-blue-900" : "bg-gray-100 text-gray-500")}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex-1 truncate font-semibold text-blue-900">{r.label}</span>
                  {r.sublabel && <span className="truncate text-xs text-gray-400">{r.sublabel}</span>}
                  {cursor === i && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
