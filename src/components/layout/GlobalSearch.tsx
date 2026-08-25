"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ListTodo, FolderKanban, Megaphone, Users as UsersIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Result {
  type: "task" | "project" | "campaign" | "user";
  id: string;
  label: string;
  sublabel?: string;
}

const ICONS = { task: ListTodo, project: FolderKanban, campaign: Megaphone, user: UsersIcon };

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

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
        supabase.from("profiles").select("id, full_name, job_title").ilike("full_name", `%${query}%`).limit(3),
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

  function go(r: Result) {
    setOpen(false);
    setQuery("");
    const routes = { task: `/tasks/${r.id}`, project: `/projects/${r.id}`, campaign: `/campaigns/${r.id}`, user: `/team/${r.id}` };
    router.push(routes[r.type]);
  }

  return (
    <div className="relative w-full max-w-md" ref={ref}>
      <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-100/60 px-4 py-2">
        <Search className="h-4 w-4 text-gray-500" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar tarefas, projetos, pessoas... (Ctrl+K)"
          className="w-full bg-transparent text-sm text-blue-900 placeholder:text-gray-500 focus:outline-none"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 z-30 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-[var(--shadow-lg)]">
          {results.map((r) => {
            const Icon = ICONS[r.type];
            return (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => go(r)}
                className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-gray-050")}
              >
                <Icon className="h-4 w-4 shrink-0 text-gray-500" />
                <span className="flex-1 truncate text-blue-900">{r.label}</span>
                {r.sublabel && <span className="text-xs text-gray-400">{r.sublabel}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
