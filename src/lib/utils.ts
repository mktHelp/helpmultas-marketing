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

// Plain `date`-column values (projects/campaigns start_date & end_date) come
// back as "YYYY-MM-DD" with no time component. `new Date("YYYY-MM-DD")`
// parses that as UTC midnight, so formatting it via the *local* timezone
// (below) would print the previous day in Brazil - these have no time
// attached at all, so read the calendar day directly instead of round
// -tripping through a timezone-aware Date.
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
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function formatDateTime(date: string | Date | null | undefined) {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function isOverdue(dueDate: string | null | undefined, completedAt: string | null | undefined) {
  if (!dueDate || completedAt) return false;
  return new Date(dueDate).getTime() < Date.now();
}

export function isToday(dateStr: string | null | undefined) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// `<input type="date">` gives a plain "YYYY-MM-DD" string. `new Date(str)`
// on a date-only string parses it as UTC midnight (a JS quirk), which then
// reads back as the *previous* day in any timezone behind UTC (like
// Brazil) - a due date of "26/08" would show as "25/08" and count as
// already overdue hours before that day even starts locally. Building the
// Date from its local year/month/day components (and pinning it to the end
// of that day) keeps the calendar day the user picked intact end-to-end.
export function dateInputToISO(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59).toISOString();
}

export function isoToDateInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
