"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { CHANGELOG, type ChangelogEntry } from "@/lib/changelog";

const CURRENT_BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "";
const POLL_MS = 2 * 60 * 1000; // consulta a versão do servidor
const BUSY_RECHECK_MS = 4000; // reavalia se a pessoa terminou o que estava fazendo
const DISMISS_KEY = "hm-update-dismissed";
const KNOWN_IDS = new Set(CHANGELOG.map((e) => e.id));

/** A pessoa está no meio de algo (modal/gaveta aberto, campo em edição, tela cheia)? Então não interrompe. */
function isBusy() {
  if (document.querySelector('[role="dialog"], [aria-modal="true"], [data-update-block]')) return true;
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  if (el.tagName === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return !["button", "checkbox", "radio", "submit", "search"].includes(type);
  }
  return false;
}

function readDismissed() {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

export function UpdateNotifier() {
  const [latest, setLatest] = useState<{ buildId: string; entries: ChangelogEntry[] } | null>(null);
  const [visible, setVisible] = useState(false);
  const checking = useRef(false);

  const check = useCallback(async () => {
    if (checking.current || !CURRENT_BUILD) return;
    checking.current = true;
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { buildId: string; entries: ChangelogEntry[] };
      if (!data.buildId || data.buildId === CURRENT_BUILD || data.buildId === readDismissed()) return;
      setLatest({ buildId: data.buildId, entries: data.entries.filter((e) => !KNOWN_IDS.has(e.id)) });
    } catch {
      // sem rede: tenta de novo no próximo ciclo
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    void check();
    const interval = setInterval(check, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  // Há versão nova pendente: só mostra quando a pessoa não está ocupada com outra coisa.
  useEffect(() => {
    if (!latest || visible) return;
    const tryShow = () => {
      if (!isBusy()) setVisible(true);
    };
    tryShow();
    const interval = setInterval(tryShow, BUSY_RECHECK_MS);
    return () => clearInterval(interval);
  }, [latest, visible]);

  if (!latest || !visible) return null;

  function dismiss() {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, latest!.buildId);
    } catch {
      // ignora
    }
    setVisible(false);
    setLatest(null);
  }

  const shown = latest.entries.slice(0, 3);
  const extra = latest.entries.length - shown.length;

  return (
    <div
      role="status"
      aria-live="polite"
      className="ast-fade-up fixed bottom-4 left-4 right-4 z-[60] rounded-3xl border border-yellow-500/60 bg-white p-4 shadow-[var(--shadow-lg)] sm:left-auto sm:w-[380px]"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-yellow-500 text-blue-900">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-blue-900">Nova versão do Hub disponível</p>
          {shown.length > 0 ? (
            <ul className="mt-1.5 space-y-1">
              {shown.map((e) => (
                <li key={e.id} className="text-[13px] leading-snug text-gray-600">
                  <span className="font-semibold text-blue-900">{e.title}</span> — {e.summary}
                </li>
              ))}
              {extra > 0 && <li className="text-xs text-gray-500">e mais {extra} {extra === 1 ? "novidade" : "novidades"}</li>}
            </ul>
          ) : (
            <p className="mt-1 text-[13px] text-gray-600">Melhorias e ajustes foram publicados. Atualize para usar a versão mais recente.</p>
          )}
        </div>
        <button type="button" onClick={dismiss} aria-label="Agora não" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-900">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-yellow-500 font-display text-sm font-semibold text-blue-900 shadow-sm transition-all hover:bg-yellow-600 active:scale-[0.97]"
        >
          <RefreshCw className="h-4 w-4" /> Atualizar agora
        </button>
        <Link href="/atualizacoes" onClick={dismiss} className="inline-flex h-10 items-center rounded-full px-3 font-display text-sm font-semibold text-blue-800 hover:bg-gray-100">
          Ver detalhes
        </Link>
      </div>
    </div>
  );
}
