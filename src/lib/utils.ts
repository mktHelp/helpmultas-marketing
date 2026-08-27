import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// Help Multas operates in one timezone, so dates are always shown/entered in
// Brazil time - hardcoded rather than relying on the runtime's ambient
// timezone. That ambient value differs by *where the code executes*: the
// dashboard renders on the server (Vercel's Node runtime defaults to UTC),
// while the task detail page renders in the visitor's browser (Brazil) - so
// the exact same stored instant could read back as two different calendar
// days depending on which one rendered it, unless the timezone is pinned
// explicitly everywhere.
const APP_TIME_ZONE = "America/Sao_Paulo";

// Plain `date`-column values (projects/campaigns start_date & end_date) come
// back as "YYYY-MM-DD" with no time component at all, so there's no instant
// to convert - read the calendar day directly instead of going through a
// Date/timezone round-trip.
function isDateOnlyString(date: unknown): date is string {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export function formatDate(date: string | Date | null | undefined) {
  if (!date) return "-";
  if (isDateOnlyString(date)) {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: APP_TIME_ZONE });
}

export function formatDateTime(date: string | Date | null | undefined) {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: APP_TIME_ZONE,
  });
}

export function isOverdue(dueDate: string | null | undefined, completedAt: string | null | undefined) {
  if (!dueDate || completedAt) return false;
  // A raw instant-vs-instant comparison, so it's already timezone-agnostic -
  // no fix needed here regardless of where this runs.
  return new Date(dueDate).getTime() < Date.now();
}

// YYYY-MM-DD for a given instant, read in APP_TIME_ZONE - used to compare
// calendar days consistently regardless of server vs. browser runtime.
// Exported for lib/stats.ts, which needs the same fix for date-fns's
// isToday()/format() (both ambient-timezone-dependent, same root issue).
export function toDateKey(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(d);
}

export function isToday(dateStr: string | null | undefined) {
  if (!dateStr) return false;
  return toDateKey(dateStr) === toDateKey(new Date());
}

// Converts a wall-clock date/time in APP_TIME_ZONE into the UTC instant it
// represents, using the "format the UTC guess back into the target zone and
// measure the drift" trick - the standard way to do timezone-aware
// conversion with only the built-in Intl API (no date-fns-tz/luxon needed).
function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, second: number) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
    .formatToParts(utcGuess)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});

  const asUtcIfGuessWereLocal = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second)
  );
  const driftMs = asUtcIfGuessWereLocal - utcGuess.getTime();
  return new Date(utcGuess.getTime() - driftMs);
}

// `<input type="date">` gives a plain "YYYY-MM-DD" string with no timezone
// info. Pins it to the end of that calendar day in Brazil time (not
// whatever timezone the browser happens to be in) so the day the user
// picked round-trips correctly everywhere it's later read back.
export function dateInputToISO(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return zonedTimeToUtc(year, month, day, 23, 59, 59).toISOString();
}

// Same as dateInputToISO but pinned to the start of the day - for the
// lower bound of a date-range filter.
export function dateInputToStartOfDayISO(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return zonedTimeToUtc(year, month, day, 0, 0, 0).toISOString();
}

export function isoToDateInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  return toDateKey(iso);
}
