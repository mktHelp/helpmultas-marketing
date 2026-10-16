"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, BarChart3, Bot, Check, Loader2, Newspaper, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeChanges } from "@/lib/hooks/useRealtimeChanges";
import { getLatestRun, startRun } from "@/lib/services/contentIdeas";
import type { ContentIdeaRun } from "@/types/database";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Buscando notícias de trânsito", hint: "Google News, fontes oficiais e tendências", icon: Newspaper },
  { label: "Analisando o que performou no Instagram", hint: "Seus melhores posts dos últimos 60 dias", icon: BarChart3 },
  { label: "IA escrevendo as pautas", hint: "Ganchos, roteiros e legendas", icon: Bot },
  { label: "Revisando e salvando", hint: "Checando fatos e guardando as pautas", icon: Save },
];
// Mesmo limite da rota /api/pautas/run: depois disso a execução é dada como travada.
const STALE_MS = 10 * 60e3;

/**
 * Botão "Gerar pautas agora" + andamento ao vivo do Radar de Pauta (n8n).
 * O estado vem de content_idea_runs (Realtime + polling de reserva), então todo
 * mundo que está com a aba aberta vê a mesma execução e o botão fica travado
 * enquanto ela roda, inclusive quando quem disparou foi o agendamento.
 */
export function RadarRunPanel({ onFinished }: { onFinished: () => void }) {
  const supabase = createClient();
  const [run, setRun] = useState<ContentIdeaRun | null>(null);
  const [starting, setStarting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const prevStatus = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRun(await getLatestRun(supabase));
    } catch (e) {
      console.error(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeChanges(["content_idea_runs"], load, { debounceMs: 150 });

  const running = run?.status === "running" && now - new Date(run.started_at).getTime() < STALE_MS;

  // Enquanto roda: relógio do tempo decorrido + polling de reserva (caso o Realtime caia).
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(load, 4000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [running, load]);

  // Terminou (por aqui ou por outra pessoa): avisa e recarrega a lista.
  useEffect(() => {
    if (!run) return;
    if (prevStatus.current === "running" && run.status === "done") {
      toast.success(`${run.ideas_count ?? 0} pautas novas prontas!`);
      onFinished();
    }
    if (prevStatus.current === "running" && run.status === "error") toast.error("A geração de pautas falhou.");
    prevStatus.current = run.status;
  }, [run, onFinished]);

  async function handleStart() {
    if (running || starting) return;
    setStarting(true);
    const res = await startRun();
    setStarting(false);
    if (res.run) {
      prevStatus.current = "running";
      setNow(Date.now());
      setRun(res.run);
    }
    if (res.alreadyRunning) toast.info("Já tem uma geração rodando. Acompanhe o andamento abaixo.");
    else if (res.error) toast.error(res.error);
  }

  const elapsed = run ? Math.max(0, Math.floor(((run.finished_at ? new Date(run.finished_at).getTime() : now) - new Date(run.started_at).getTime()) / 1000)) : 0;
  const elapsedLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const stale = run?.status === "running" && !running;

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-blue-900">
            {running ? "Gerando pautas…" : "Radar de Pauta"}
          </p>
          <p className="text-xs text-gray-500">
            {running
              ? `${run!.source === "manual" ? "Disparado pelo botão" : "Execução agendada"} · ${elapsedLabel} · leva de 1 a 3 minutos`
              : run?.status === "done"
                ? `Última geração ${formatDistanceToNow(new Date(run.finished_at ?? run.started_at), { locale: ptBR, addSuffix: true })} · ${run.ideas_count ?? 0} pautas`
                : "Roda sozinho às 7h30 e 13h30. Quer pautas fresquinhas agora? Clique ao lado."}
          </p>
        </div>
        <Button onClick={handleStart} disabled={running || starting} className="gap-1.5">
          {running || starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {starting ? "Iniciando…" : running ? "Gerando…" : "Gerar pautas agora"}
        </Button>
      </div>

      {running && (
        <div className="mt-5" aria-live="polite">
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-[width] duration-700 ease-out"
              style={{ width: `${Math.min(96, ((run!.step - 1) / STEPS.length) * 100 + 8)}%` }}
            />
          </div>
          <ol className="grid gap-3 sm:grid-cols-4">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const done = run!.step > n;
              const active = run!.step === n;
              const Icon = s.icon;
              return (
                <li key={s.label} className="relative flex gap-3 sm:flex-col sm:gap-2">
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-[1.15rem] top-10 h-[calc(100%-1.5rem)] w-0.5 rounded-full transition-colors duration-500 sm:left-12 sm:top-[1.15rem] sm:h-0.5 sm:w-[calc(100%-2rem)]",
                        done ? "bg-green-400" : "bg-gray-200"
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500",
                      done && "border-green-500 bg-green-500 text-white",
                      active && "border-yellow-500 bg-yellow-500 text-blue-900 shadow-[0_0_0_5px_rgba(224,169,0,0.18)]",
                      !done && !active && "border-gray-200 bg-white text-gray-300"
                    )}
                  >
                    {done ? <Check className="ast-pop h-4 w-4" strokeWidth={3} /> : <Icon className={cn("h-4 w-4", active && "animate-pulse")} />}
                  </span>
                  <div className="min-w-0 pb-1">
                    <p className={cn("text-xs font-bold leading-tight", done ? "text-green-700" : active ? "text-blue-900" : "text-gray-400")}>
                      {active ? run!.step_label : s.label}
                    </p>
                    <p className={cn("mt-0.5 text-[11px] leading-snug", active ? "text-gray-600" : "text-gray-400")}>
                      {done ? "Concluído" : s.hint}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {(run?.status === "error" || stale) && (
        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          A última geração falhou{run?.error_message ? `: ${run.error_message}` : stale ? " (passou de 10 minutos sem terminar)" : ""}. Pode tentar de novo.
        </p>
      )}
    </div>
  );
}
