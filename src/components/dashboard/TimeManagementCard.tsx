import { Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { timeByContentType } from "@/lib/stats";

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m}min` : `${h}h`;
}

export function TimeManagementCard({ rows }: { rows: ReturnType<typeof timeByContentType> }) {
  return (
    <Card className="p-5">
      <h3 className="font-display text-[17px] font-semibold text-blue-900">Gestão de tempo</h3>
      <p className="mt-0.5 text-xs text-gray-500">Tempo estimado vs. real, por tipo de conteúdo</p>

      {rows.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 py-6 text-center">
          <Clock className="h-6 w-6 text-gray-300" />
          <p className="text-sm text-gray-400">
            Ainda sem dados — preencha o tempo estimado e o tempo real gasto nas tarefas.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {rows.map((r) => (
            <div key={r.contentType} className="flex items-center justify-between rounded-lg bg-gray-050 px-3 py-2 text-sm">
              <div>
                <p className="font-semibold text-blue-900">{r.label}</p>
                <p className="text-xs text-gray-500">
                  Estimado {formatMinutes(r.estimatedAvg)} · Real {formatMinutes(r.actualAvg)}
                </p>
              </div>
              <span
                className={cn(
                  "text-xs font-bold",
                  r.diffMinutes > 0 ? "text-[color:var(--color-danger)]" : "text-[color:var(--color-success)]"
                )}
              >
                {r.diffMinutes > 0 ? "+" : ""}
                {formatMinutes(Math.abs(r.diffMinutes))}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
