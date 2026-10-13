import { Badge } from "@/components/ui/Badge";

type Tone = "success" | "accent" | "neutral" | "danger" | "info";

const STATUSES: Record<string, { pt: string; en: string; tone: Tone }> = {
  SCHEDULED: { pt: "Agendada", en: "Scheduled", tone: "info" },
  DONE: { pt: "Realizada", en: "Done", tone: "success" },
  NO_SHOW: { pt: "Não compareceu", en: "No-show", tone: "danger" },
  RESCHEDULED: { pt: "Remarcada", en: "Rescheduled", tone: "accent" },
};

export const NO_MEETING = { pt: "Sem reunião", en: "No meeting" };

export function meetingStatusInfo(status: string | null | undefined) {
  return status ? STATUSES[status.trim().toUpperCase()] ?? null : null;
}

/** Texto plano "Realizada / Done" (busca, chips, filtros). */
export function meetingStatusText(status: string | null | undefined): string {
  if (!status) return `${NO_MEETING.pt} / ${NO_MEETING.en}`;
  const s = meetingStatusInfo(status);
  return s ? `${s.pt} / ${s.en}` : status;
}

/** Português em destaque, inglês em cinza claro. */
export function MeetingStatusLabel({ status }: { status: string | null | undefined }) {
  const s = status ? meetingStatusInfo(status) : NO_MEETING;
  if (!s) return <>{status}</>;
  return (
    <>
      {s.pt} <span className="font-normal text-gray-400">/ {s.en}</span>
    </>
  );
}

export function MeetingStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-gray-400">—</span>;
  const s = meetingStatusInfo(status);
  if (!s) return <Badge tone="neutral">{status}</Badge>;
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge tone={s.tone} className="whitespace-nowrap">{s.pt}</Badge>
      <span className="pl-2.5 text-[11px] leading-none text-gray-400">{s.en}</span>
    </div>
  );
}
