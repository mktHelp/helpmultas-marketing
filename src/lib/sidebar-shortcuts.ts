"use client";

import { useCallback, useEffect, useState } from "react";
import { locateNav } from "@/lib/navigation";

// Atalhos da sidebar, lembrados neste navegador: abas fixadas pela pessoa e as últimas abas
// que ela visitou (a mais recente primeiro). Guardamos só o href do item do menu.

const PINNED_KEY = "hm-sidebar-pinned";
const RECENT_KEY = "hm-sidebar-recent";
const RECENT_MAX = 6;

function read(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(key: string, value: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sem localStorage: segue sem lembrar
  }
}

export function useSidebarShortcuts(pathname: string) {
  const [pinned, setPinned] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setPinned(read(PINNED_KEY));
    setRecent(read(RECENT_KEY));
  }, []);

  // Cada troca de aba entra no topo dos recentes.
  useEffect(() => {
    const href = locateNav(pathname)?.item.href;
    if (!href) return;
    setRecent((current) => {
      if (current[0] === href) return current;
      const next = [href, ...current.filter((h) => h !== href)].slice(0, RECENT_MAX);
      write(RECENT_KEY, next);
      return next;
    });
  }, [pathname]);

  const togglePin = useCallback((href: string) => {
    setPinned((current) => {
      const next = current.includes(href) ? current.filter((h) => h !== href) : [...current, href];
      write(PINNED_KEY, next);
      return next;
    });
  }, []);

  return { pinned, recent, togglePin };
}
