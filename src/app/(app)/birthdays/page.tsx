"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  addMonths, differenceInCalendarDays, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Cake, CalendarClock, CalendarDays, Home, PartyPopper, Paperclip, Trash2, Plus, Pencil, Download, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Input, Label } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { listProfiles } from "@/lib/services/profiles";
import {
  createBirthday, deleteBirthday, deleteBirthdayPhoto, getBirthdayPhotoUrl,
  listBirthdayOwners, listBirthdayPhotos, listBirthdays, setBirthdayOwners, updateBirthday, uploadBirthdayPhoto,
} from "@/lib/services/birthdays";
import {
  createWorkAnniversary, deleteWorkAnniversary, deleteWorkAnniversaryPhoto, getWorkAnniversaryPhotoUrl,
  listWorkAnniversaries, listWorkAnniversaryOwners, listWorkAnniversaryPhotos, setWorkAnniversaryOwners,
  updateWorkAnniversary, uploadWorkAnniversaryPhoto,
} from "@/lib/services/workAnniversaries";
import { cn, initials } from "@/lib/utils";
import type {
  Birthday, BirthdayOwner, BirthdayPhoto, Profile, WorkAnniversary, WorkAnniversaryOwner, WorkAnniversaryPhoto,
} from "@/types/database";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

type MonthDay = { month: number; day: number };

function occurrenceThisYear(md: MonthDay, referenceYear: number) {
  return new Date(referenceYear, md.month - 1, md.day);
}

function nextOccurrence(md: MonthDay) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let occ = occurrenceThisYear(md, now.getFullYear());
  if (occ < now) occ = occurrenceThisYear(md, now.getFullYear() + 1);
  return occ;
}

function formatMonthDay(md: MonthDay) {
  return `${String(md.day).padStart(2, "0")} de ${MONTH_NAMES[md.month - 1]}`;
}

function parseDateParts(isoDate: string): MonthDay & { year: number } {
  const [y, m, d] = isoDate.split("-").map(Number);
  return { year: y, month: m, day: d };
}

// ------------------------- Page -------------------------

export default function BirthdaysPage() {
  const supabase = createClient();
  const [kind, setKind] = useState<"life" | "work">("life");
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    listProfiles(supabase).then(setProfiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const KINDS = [
    { key: "life" as const, label: "Aniversário de Vida", icon: Cake },
    { key: "work" as const, label: "Aniversário de Casa", icon: Home },
  ];

  return (
    <div>
      <PageHeader
        title="Aniversários"
        description="Aniversário de vida e de casa da equipe, com data e fotos para postar nos stories."
        action={
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-gray-100 p-1" role="tablist">
            {KINDS.map((k) => {
              const Icon = k.icon;
              const active = kind === k.key;
              return (
                <button
                  key={k.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setKind(k.key)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200",
                    active ? "bg-blue-900 text-white shadow-sm" : "text-gray-700 hover:text-blue-900"
                  )}
                >
                  <Icon className={cn("h-4 w-4 transition-transform duration-200", active && "scale-110 text-yellow-400")} />
                  {k.label}
                </button>
              );
            })}
          </div>
        }
      />
      <div key={kind} className="ast-fade-up">
        {kind === "life" ? <LifeBirthdays profiles={profiles} /> : <WorkAnniversaries profiles={profiles} />}
      </div>
    </div>
  );
}

function OwnerAvatars({ profileIds, profiles, size = "sm" }: { profileIds: string[]; profiles: Profile[]; size?: "xs" | "sm" }) {
  if (profileIds.length === 0) return null;
  const owners = profileIds.map((id) => profiles.find((p) => p.id === id)).filter((p): p is Profile => !!p);
  if (owners.length === 0) return null;
  return (
    <div className="flex items-center -space-x-2">
      {owners.map((p) => (
        <UserAvatar key={p.id} name={p.full_name} avatarUrl={p.avatar_url} size={size} className="ring-2 ring-white" />
      ))}
    </div>
  );
}

// ------------------------- Shared calendar/cards shell -------------------------

const MONTH_COLORS = [
  "#3b82f6", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4",
  "#ef4444", "#84cc16", "#f97316", "#6366f1", "#14b8a6", "#e11d48",
];

function daysUntil(md: MonthDay) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return differenceInCalendarDays(nextOccurrence(md), today);
}

function countdownLabel(days: number) {
  if (days === 0) return "Hoje!";
  if (days === 1) return "Amanhã";
  return `em ${days} dias`;
}

function AnniversaryBoard<T extends { id: string; name: string; notes: string | null }>({
  items, getMonthDay, getBadgeExtra, photoCounts, ownerIds, profiles, onSelect, onCreate, emptyLabel,
}: {
  items: T[];
  getMonthDay: (item: T) => MonthDay;
  getBadgeExtra?: (item: T) => string | null;
  photoCounts: Map<string, number>;
  ownerIds: (item: T) => string[];
  profiles: Profile[];
  onSelect: (item: T) => void;
  onCreate: () => void;
  emptyLabel: string;
}) {
  const [view, setView] = useState<"cards" | "calendar">("cards");
  const [month, setMonth] = useState(new Date());
  const [monthFilter, setMonthFilter] = useState<number | null>(null);

  const sorted = useMemo(
    () => [...items].sort((a, b) => nextOccurrence(getMonthDay(a)).getTime() - nextOccurrence(getMonthDay(b)).getTime()),
    [items, getMonthDay]
  );

  const stats = useMemo(() => {
    const now = new Date();
    let today = 0;
    let week = 0;
    let thisMonth = 0;
    for (const it of items) {
      const md = getMonthDay(it);
      const d = daysUntil(md);
      if (d === 0) today++;
      if (d <= 7) week++;
      if (md.month === now.getMonth() + 1) thisMonth++;
    }
    return { today, week, thisMonth, total: items.length };
  }, [items, getMonthDay]);

  const visible = useMemo(
    () => (monthFilter === null ? sorted : sorted.filter((it) => getMonthDay(it).month === monthFilter)),
    [sorted, monthFilter, getMonthDay]
  );

  const hero = sorted[0] ?? null;
  const heroDays = hero ? daysUntil(getMonthDay(hero)) : null;
  const heroToday = heroDays === 0;
  const todayPeople = heroToday ? sorted.filter((it) => daysUntil(getMonthDay(it)) === 0) : [];

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const itemsForDay = (day: Date) =>
    items.filter((it) => isSameDay(occurrenceThisYear(getMonthDay(it), day.getFullYear()), day));

  return (
    <div>
      {hero && heroDays !== null && (
        <div
          className={cn(
            "ast-fade-up relative mb-5 overflow-hidden rounded-3xl p-5 sm:p-6",
            heroToday
              ? "bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-400 text-blue-900"
              : "bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 text-white"
          )}
        >
          {heroToday &&
            Array.from({ length: 14 }).map((_, i) => (
              <span
                key={i}
                aria-hidden
                className="pg-confetti pointer-events-none absolute top-0 h-2 w-2 rounded-sm"
                style={{
                  left: `${(i * 7 + 4) % 100}%`,
                  animationDelay: `${(i % 7) * 0.35}s`,
                  backgroundColor: ["#243746", "#ffffff", "#e11d48", "#3b82f6", "#10b981"][i % 5],
                }}
              />
            ))}
          <div className="relative flex flex-wrap items-center gap-4">
            <span
              className={cn(
                "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-lg",
                heroToday ? "bg-blue-900 text-yellow-400" : "bg-yellow-500 text-blue-900"
              )}
            >
              {heroToday ? <PartyPopper className="h-8 w-8" /> : <Cake className="h-8 w-8" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-xs font-bold uppercase tracking-widest", heroToday ? "text-blue-900/70" : "text-yellow-400")}>
                {heroToday ? "É hoje!" : "Próximo da lista"}
              </p>
              <p className="truncate font-display text-xl font-bold sm:text-2xl">
                {heroToday ? todayPeople.map((p) => p.name).join(" · ") : hero.name}
              </p>
              <p className={cn("text-sm", heroToday ? "text-blue-900/80" : "text-blue-100")}>
                {heroToday
                  ? "Não esqueça de postar no story. 🎂"
                  : `${formatMonthDay(getMonthDay(hero))} · ${countdownLabel(heroDays)}`}
              </p>
            </div>
            {!heroToday && (
              <button
                type="button"
                onClick={() => onSelect(hero)}
                className="rounded-full bg-yellow-500 px-4 py-2 font-display text-sm font-semibold text-blue-900 shadow-sm transition-all hover:bg-yellow-400 active:scale-95"
              >
                Ver detalhes
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={PartyPopper} label="Hoje" value={stats.today} color="#e0a900" index={0} />
        <StatCard icon={CalendarClock} label="Próximos 7 dias" value={stats.week} color="#3b82f6" index={1} />
        <StatCard icon={CalendarDays} label="Neste mês" value={stats.thisMonth} color="#8b5cf6" index={2} />
        <StatCard icon={Users} label="Cadastrados" value={stats.total} color="#375367" index={3} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[{ key: "cards", label: "Cards" }, { key: "calendar", label: "Calendário" }]}
          active={view}
          onChange={(v) => setView(v as "cards" | "calendar")}
        />
        <Button onClick={onCreate} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={Cake} title="Nada cadastrado ainda" description={emptyLabel} actionLabel="Adicionar" onAction={onCreate} />
      ) : view === "cards" ? (
        <>
          <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setMonthFilter(null)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition-all active:scale-95",
                monthFilter === null ? "border-blue-900 bg-blue-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              )}
            >
              Todos
            </button>
            {MONTH_NAMES.map((name, i) => {
              const count = sorted.filter((it) => getMonthDay(it).month === i + 1).length;
              const active = monthFilter === i + 1;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setMonthFilter(active ? null : i + 1)}
                  disabled={count === 0 && !active}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition-all active:scale-95 disabled:opacity-35",
                    active ? "border-transparent text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  )}
                  style={active ? { backgroundColor: MONTH_COLORS[i] } : undefined}
                >
                  {name.slice(0, 3)}
                  {count > 0 && <span className={cn("ml-1", active ? "text-white/80" : "text-gray-400")}>{count}</span>}
                </button>
              );
            })}
          </div>

          {visible.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">Ninguém em {monthFilter ? MONTH_NAMES[monthFilter - 1] : "este filtro"}.</p>
          ) : (
            <div key={monthFilter ?? "all"} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visible.map((it, i) => {
                const md = getMonthDay(it);
                const d = daysUntil(md);
                const isTodayItem = d === 0;
                const color = MONTH_COLORS[md.month - 1];
                const photos = photoCounts.get(it.id) || 0;
                return (
                  <button
                    type="button"
                    key={it.id}
                    onClick={() => onSelect(it)}
                    style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                    className={cn(
                      "kb-card-in group relative overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-[var(--shadow-sm)] transition-all duration-200",
                      "hover:-translate-y-1 hover:shadow-[var(--shadow-md)] active:translate-y-0",
                      isTodayItem ? "pg-pulse-soft border-yellow-500 bg-yellow-050" : "border-gray-200"
                    )}
                  >
                    <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} aria-hidden />
                    <div className="flex items-center gap-3.5">
                      <span
                        className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl leading-none text-white shadow-sm transition-transform duration-200 group-hover:scale-105 group-hover:-rotate-3"
                        style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
                      >
                        <span className="font-display text-2xl font-bold">{md.day}</span>
                        <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide">{MONTH_NAMES[md.month - 1].slice(0, 3)}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display font-bold text-blue-900">{it.name}</p>
                        {it.notes && <p className="truncate text-xs text-gray-500">{it.notes}</p>}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-bold",
                              isTodayItem ? "bg-yellow-500 text-blue-900" : d <= 7 ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"
                            )}
                          >
                            {countdownLabel(d)}
                          </span>
                          {getBadgeExtra?.(it) && (
                            <span className="rounded-full bg-blue-050 px-2 py-0.5 text-[11px] font-bold text-blue-700">{getBadgeExtra(it)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Paperclip className="h-3.5 w-3.5" />
                        {photos === 0 ? "Sem fotos anexadas" : `${photos} foto(s) anexada(s)`}
                      </span>
                      <OwnerAvatars profileIds={ownerIds(it)} profiles={profiles} size="xs" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-center gap-2">
            <Button size="icon" variant="secondary" onClick={() => setMonth(subMonths(month, 1))} aria-label="Mês anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="w-36 text-center font-display text-sm font-bold capitalize text-blue-900">
              {format(month, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button size="icon" variant="secondary" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div key={format(month, "yyyy-MM")} className="ast-fade-up hidden grid-cols-7 gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200 shadow-[var(--shadow-sm)] sm:grid">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d, i) => (
              <div key={d} className={cn("py-2.5 text-center text-xs font-bold uppercase tracking-wide text-white", i === 0 || i === 6 ? "bg-blue-800" : "bg-blue-900")}>
                {d}
              </div>
            ))}
            {days.map((day) => {
              const dayItems = itemsForDay(day);
              const weekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div
                  key={day.toISOString()}
                  className={cn("min-h-[110px] p-1.5", weekend ? "bg-gray-050" : "bg-white", !isSameMonth(day, month) && "bg-gray-100/70 opacity-60")}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                      isToday(day) ? "pg-pulse-soft bg-yellow-500 text-blue-900" : "text-gray-500"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayItems.map((it) => (
                      <button
                        key={it.id}
                        onClick={() => onSelect(it)}
                        className="flex w-full items-center gap-1 truncate rounded-md bg-yellow-100 px-1.5 py-0.5 text-left text-[11px] font-semibold text-blue-900 transition-all hover:translate-x-0.5 hover:bg-yellow-200"
                      >
                        <Cake className="h-3 w-3 shrink-0" />
                        <span className="truncate">{it.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3 sm:hidden">
            {days.filter((d) => isSameMonth(d, month) && itemsForDay(d).length > 0).length === 0 && (
              <p className="py-10 text-center text-sm text-gray-400">Nada neste mês.</p>
            )}
            {days
              .filter((day) => isSameMonth(day, month))
              .map((day) => {
                const dayItems = itemsForDay(day);
                if (dayItems.length === 0) return null;
                return (
                  <div key={day.toISOString()} className="kb-card-in rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                          isToday(day) ? "bg-yellow-500 text-blue-900" : "bg-gray-050 text-gray-500"
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      <span className="text-sm font-semibold capitalize text-blue-900">{format(day, "EEEE", { locale: ptBR })}</span>
                    </div>
                    <div className="space-y-1.5">
                      {dayItems.map((it) => (
                        <button
                          key={it.id}
                          onClick={() => onSelect(it)}
                          className="flex w-full items-center gap-1.5 rounded-md bg-yellow-100 px-2 py-1.5 text-left text-xs font-semibold text-blue-900 hover:bg-yellow-200"
                        >
                          <Cake className="h-3.5 w-3.5 shrink-0" />
                          {it.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------- Aniversário de Vida -------------------------

function LifeBirthdays({ profiles }: { profiles: Profile[] }) {
  const supabase = createClient();
  const { profile: me } = useAuth();
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [photos, setPhotos] = useState<BirthdayPhoto[]>([]);
  const [owners, setOwnersState] = useState<BirthdayOwner[]>([]);
  const [selected, setSelected] = useState<Birthday | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Birthday | null>(null);

  const load = useCallback(() => {
    listBirthdays(supabase).then(setBirthdays);
    listBirthdayPhotos(supabase).then(setPhotos);
    listBirthdayOwners(supabase).then(setOwnersState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const photoCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of photos) map.set(p.birthday_id, (map.get(p.birthday_id) || 0) + 1);
    return map;
  }, [photos]);

  const photosFor = (id: string) => photos.filter((p) => p.birthday_id === id);
  const ownersFor = (id: string) => owners.filter((o) => o.birthday_id === id).map((o) => o.profile_id);

  return (
    <div>
      <AnniversaryBoard
        items={birthdays}
        getMonthDay={(b) => ({ month: b.birth_month, day: b.birth_day })}
        photoCounts={photoCounts}
        ownerIds={(b) => ownersFor(b.id)}
        profiles={profiles}
        onSelect={setSelected}
        onCreate={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        emptyLabel="Clique em 'Novo' para adicionar o primeiro aniversário."
      />

      {selected && (
        <LifeBirthdayDialog
          birthday={selected}
          photos={photosFor(selected.id)}
          ownerIds={ownersFor(selected.id)}
          profiles={profiles}
          onClose={() => setSelected(null)}
          onChanged={load}
          onEdit={() => {
            setEditing(selected);
            setFormOpen(true);
          }}
          onDeleted={() => {
            setSelected(null);
            load();
          }}
          userId={me?.id || ""}
        />
      )}

      {formOpen && (
        <LifeBirthdayFormDialog
          birthday={editing}
          ownerIds={editing ? ownersFor(editing.id) : []}
          profiles={profiles}
          userId={me?.id || ""}
          onClose={() => setFormOpen(false)}
          onSaved={(b) => {
            setFormOpen(false);
            load();
            setSelected(b);
          }}
        />
      )}
    </div>
  );
}

function LifeBirthdayFormDialog({
  birthday, ownerIds, profiles, userId, onClose, onSaved,
}: {
  birthday: Birthday | null;
  ownerIds: string[];
  profiles: Profile[];
  userId: string;
  onClose: () => void;
  onSaved: (b: Birthday) => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState(birthday?.name || "");
  const [month, setMonth] = useState(birthday?.birth_month || 1);
  const [day, setDay] = useState(birthday?.birth_day || 1);
  const [notes, setNotes] = useState(birthday?.notes || "");
  const [selectedOwners, setSelectedOwners] = useState<string[]>(ownerIds);
  const [saving, setSaving] = useState(false);
  const daysInMonth = DAYS_IN_MONTH[month - 1];

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Preencha o nome");
      return;
    }
    setSaving(true);
    try {
      const input = { name, birth_month: month, birth_day: day, notes: notes || null };
      const saved = birthday
        ? await updateBirthday(supabase, birthday.id, input)
        : await createBirthday(supabase, userId, input);
      await setBirthdayOwners(supabase, saved.id, selectedOwners);
      toast.success(birthday ? "Aniversário atualizado" : "Aniversário criado");
      onSaved(saved);
    } catch {
      toast.error("Erro ao salvar aniversário");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} size="sm">
      <DialogHeader title={birthday ? "Editar aniversário" : "Novo aniversário de vida"} onClose={onClose} />
      <DialogBody className="space-y-4">
        <div>
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do colaborador" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Dia</Label>
            <Select value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Mês</Label>
            <Select
              value={month}
              onChange={(e) => {
                const m = Number(e.target.value);
                setMonth(m);
                if (day > DAYS_IN_MONTH[m - 1]) setDay(DAYS_IN_MONTH[m - 1]);
              }}
            >
              {MONTH_NAMES.map((label, i) => (
                <option key={label} value={i + 1}>{label}</option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label>Observações (opcional)</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cargo, equipe, etc." />
        </div>
        <div>
          <Label>Responsáveis por postar o story</Label>
          <MultiSelect
            placeholder="Selecionar responsáveis"
            options={profiles.map((p) => ({ value: p.id, label: p.full_name }))}
            selected={selectedOwners}
            onChange={setSelectedOwners}
            className="w-full"
          />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </DialogFooter>
    </Dialog>
  );
}

function LifeBirthdayDialog({
  birthday, photos, ownerIds, profiles, onClose, onChanged, onEdit, onDeleted, userId,
}: {
  birthday: Birthday;
  photos: BirthdayPhoto[];
  ownerIds: string[];
  profiles: Profile[];
  onClose: () => void;
  onChanged: () => void;
  onEdit: () => void;
  onDeleted: () => void;
  userId: string;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    (async () => {
      const entries = await Promise.all(
        photos.map(async (p) => [p.id, await getBirthdayPhotoUrl(supabase, p.file_path, p.file_name)] as const)
      );
      setUrls(Object.fromEntries(entries));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) await uploadBirthdayPhoto(supabase, birthday.id, userId, file);
      toast.success("Foto anexada");
      onChanged();
    } catch {
      toast.error("Erro ao enviar foto");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDeletePhoto(photo: BirthdayPhoto) {
    try {
      await deleteBirthdayPhoto(supabase, photo.id, photo.file_path);
      toast.success("Foto removida");
      onChanged();
    } catch {
      toast.error("Erro ao remover foto");
    }
  }

  async function handleDeleteBirthday() {
    try {
      await deleteBirthday(supabase, birthday.id);
      toast.success("Aniversário removido");
      onDeleted();
    } catch {
      toast.error("Erro ao remover aniversário");
    }
  }

  return (
    <>
      <Dialog open onClose={onClose} size="lg">
        <DialogHeader
          title={birthday.name}
          subtitle={`Aniversário em ${formatMonthDay({ month: birthday.birth_month, day: birthday.birth_day })}`}
          onClose={onClose}
        />
        <DialogBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-900 font-display text-lg font-bold text-white">
                {initials(birthday.name)}
              </span>
              <div>
                <p className="font-display font-bold text-blue-900">{birthday.name}</p>
                {birthday.notes && <p className="text-xs text-gray-500">{birthday.notes}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="icon" variant="secondary" onClick={onEdit} title="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="secondary" onClick={() => setConfirmDelete(true)} title="Excluir">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <OwnerList ownerIds={ownerIds} profiles={profiles} />

          <PhotoGrid
            photos={photos}
            urls={urls}
            uploading={uploading}
            fileRef={fileRef}
            onUpload={handleUpload}
            onDeletePhoto={handleDeletePhoto}
          />
        </DialogBody>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDeleteBirthday}
        title="Excluir aniversário"
        description={`Tem certeza que deseja excluir o aniversário de ${birthday.name}? As fotos anexadas também serão removidas.`}
        confirmLabel="Excluir"
        danger
      />
    </>
  );
}

// ------------------------- Aniversário de Casa -------------------------

function WorkAnniversaries({ profiles }: { profiles: Profile[] }) {
  const supabase = createClient();
  const { profile: me } = useAuth();
  const [items, setItems] = useState<WorkAnniversary[]>([]);
  const [photos, setPhotos] = useState<WorkAnniversaryPhoto[]>([]);
  const [owners, setOwnersState] = useState<WorkAnniversaryOwner[]>([]);
  const [selected, setSelected] = useState<WorkAnniversary | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WorkAnniversary | null>(null);

  const load = useCallback(() => {
    listWorkAnniversaries(supabase).then(setItems);
    listWorkAnniversaryPhotos(supabase).then(setPhotos);
    listWorkAnniversaryOwners(supabase).then(setOwnersState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const photoCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of photos) map.set(p.work_anniversary_id, (map.get(p.work_anniversary_id) || 0) + 1);
    return map;
  }, [photos]);

  const photosFor = (id: string) => photos.filter((p) => p.work_anniversary_id === id);
  const ownersFor = (id: string) => owners.filter((o) => o.work_anniversary_id === id).map((o) => o.profile_id);

  function yearsFor(w: WorkAnniversary) {
    const { year, month, day } = parseDateParts(w.hire_date);
    const occ = nextOccurrence({ month, day });
    return occ.getFullYear() - year;
  }

  return (
    <div>
      <AnniversaryBoard
        items={items}
        getMonthDay={(w) => {
          const { month, day } = parseDateParts(w.hire_date);
          return { month, day };
        }}
        getBadgeExtra={(w) => {
          const yrs = yearsFor(w);
          return yrs > 0 ? `${yrs} ano(s) de empresa` : null;
        }}
        photoCounts={photoCounts}
        ownerIds={(w) => ownersFor(w.id)}
        profiles={profiles}
        onSelect={setSelected}
        onCreate={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        emptyLabel="Clique em 'Novo' para adicionar o primeiro aniversário de casa."
      />

      {selected && (
        <WorkAnniversaryDialog
          item={selected}
          years={yearsFor(selected)}
          photos={photosFor(selected.id)}
          ownerIds={ownersFor(selected.id)}
          profiles={profiles}
          onClose={() => setSelected(null)}
          onChanged={load}
          onEdit={() => {
            setEditing(selected);
            setFormOpen(true);
          }}
          onDeleted={() => {
            setSelected(null);
            load();
          }}
          userId={me?.id || ""}
        />
      )}

      {formOpen && (
        <WorkAnniversaryFormDialog
          item={editing}
          ownerIds={editing ? ownersFor(editing.id) : []}
          profiles={profiles}
          userId={me?.id || ""}
          onClose={() => setFormOpen(false)}
          onSaved={(w) => {
            setFormOpen(false);
            load();
            setSelected(w);
          }}
        />
      )}
    </div>
  );
}

function WorkAnniversaryFormDialog({
  item, ownerIds, profiles, userId, onClose, onSaved,
}: {
  item: WorkAnniversary | null;
  ownerIds: string[];
  profiles: Profile[];
  userId: string;
  onClose: () => void;
  onSaved: (w: WorkAnniversary) => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState(item?.name || "");
  const [hireDate, setHireDate] = useState(item?.hire_date || "");
  const [notes, setNotes] = useState(item?.notes || "");
  const [selectedOwners, setSelectedOwners] = useState<string[]>(ownerIds);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim() || !hireDate) {
      toast.error("Preencha nome e data de contratação");
      return;
    }
    setSaving(true);
    try {
      const input = { name, hire_date: hireDate, notes: notes || null };
      const saved = item
        ? await updateWorkAnniversary(supabase, item.id, input)
        : await createWorkAnniversary(supabase, userId, input);
      await setWorkAnniversaryOwners(supabase, saved.id, selectedOwners);
      toast.success(item ? "Aniversário de casa atualizado" : "Aniversário de casa criado");
      onSaved(saved);
    } catch {
      toast.error("Erro ao salvar aniversário de casa");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} size="sm">
      <DialogHeader title={item ? "Editar aniversário de casa" : "Novo aniversário de casa"} onClose={onClose} />
      <DialogBody className="space-y-4">
        <div>
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do colaborador" autoFocus />
        </div>
        <div>
          <Label>Data de contratação</Label>
          <Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
        </div>
        <div>
          <Label>Observações (opcional)</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cargo, equipe, etc." />
        </div>
        <div>
          <Label>Responsáveis por postar o story</Label>
          <MultiSelect
            placeholder="Selecionar responsáveis"
            options={profiles.map((p) => ({ value: p.id, label: p.full_name }))}
            selected={selectedOwners}
            onChange={setSelectedOwners}
            className="w-full"
          />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </DialogFooter>
    </Dialog>
  );
}

function WorkAnniversaryDialog({
  item, years, photos, ownerIds, profiles, onClose, onChanged, onEdit, onDeleted, userId,
}: {
  item: WorkAnniversary;
  years: number;
  photos: WorkAnniversaryPhoto[];
  ownerIds: string[];
  profiles: Profile[];
  onClose: () => void;
  onChanged: () => void;
  onEdit: () => void;
  onDeleted: () => void;
  userId: string;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { month, day } = parseDateParts(item.hire_date);

  useEffect(() => {
    (async () => {
      const entries = await Promise.all(
        photos.map(async (p) => [p.id, await getWorkAnniversaryPhotoUrl(supabase, p.file_path, p.file_name)] as const)
      );
      setUrls(Object.fromEntries(entries));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) await uploadWorkAnniversaryPhoto(supabase, item.id, userId, file);
      toast.success("Foto anexada");
      onChanged();
    } catch {
      toast.error("Erro ao enviar foto");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDeletePhoto(photo: WorkAnniversaryPhoto) {
    try {
      await deleteWorkAnniversaryPhoto(supabase, photo.id, photo.file_path);
      toast.success("Foto removida");
      onChanged();
    } catch {
      toast.error("Erro ao remover foto");
    }
  }

  async function handleDeleteItem() {
    try {
      await deleteWorkAnniversary(supabase, item.id);
      toast.success("Aniversário de casa removido");
      onDeleted();
    } catch {
      toast.error("Erro ao remover aniversário de casa");
    }
  }

  return (
    <>
      <Dialog open onClose={onClose} size="lg">
        <DialogHeader
          title={item.name}
          subtitle={
            years > 0
              ? `${formatMonthDay({ month, day })} · completa ${years} ano(s) de empresa`
              : formatMonthDay({ month, day })
          }
          onClose={onClose}
        />
        <DialogBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-900 font-display text-lg font-bold text-white">
                <PartyPopper className="h-6 w-6" />
              </span>
              <div>
                <p className="font-display font-bold text-blue-900">{item.name}</p>
                {item.notes && <p className="text-xs text-gray-500">{item.notes}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="icon" variant="secondary" onClick={onEdit} title="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="secondary" onClick={() => setConfirmDelete(true)} title="Excluir">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <OwnerList ownerIds={ownerIds} profiles={profiles} />

          <PhotoGrid
            photos={photos}
            urls={urls}
            uploading={uploading}
            fileRef={fileRef}
            onUpload={handleUpload}
            onDeletePhoto={handleDeletePhoto}
          />
        </DialogBody>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDeleteItem}
        title="Excluir aniversário de casa"
        description={`Tem certeza que deseja excluir o aniversário de casa de ${item.name}? As fotos anexadas também serão removidas.`}
        confirmLabel="Excluir"
        danger
      />
    </>
  );
}

// ------------------------- Shared owner list -------------------------

function OwnerList({ ownerIds, profiles }: { ownerIds: string[]; profiles: Profile[] }) {
  const owners = ownerIds.map((id) => profiles.find((p) => p.id === id)).filter((p): p is Profile => !!p);

  return (
    <div>
      <p className="mb-2 font-display text-sm font-bold text-blue-900">Responsáveis por postar o story</p>
      {owners.length === 0 ? (
        <p className="rounded-lg bg-gray-050 p-3 text-center text-sm text-gray-500">Nenhum responsável vinculado.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {owners.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-full bg-gray-050 py-1 pl-1 pr-3">
              <UserAvatar name={p.full_name} avatarUrl={p.avatar_url} size="xs" />
              <span className="text-xs font-semibold text-blue-900">{p.full_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------- Shared photo grid -------------------------

function PhotoGrid<T extends { id: string; file_name: string }>({
  photos, urls, uploading, fileRef, onUpload, onDeletePhoto,
}: {
  photos: T[];
  urls: Record<string, string>;
  uploading: boolean;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (files: FileList | null) => void;
  onDeletePhoto: (photo: T) => void;
}) {
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-display text-sm font-bold text-blue-900">Fotos para o story</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onUpload(e.target.files)}
        />
        <Button size="sm" variant="secondary" disabled={uploading} onClick={() => fileRef.current?.click()}>
          <Paperclip className="mr-1.5 h-4 w-4" />
          {uploading ? "Enviando..." : "Anexar foto"}
        </Button>
      </div>

      {photos.length === 0 ? (
        <p className="rounded-lg bg-gray-050 p-4 text-center text-sm text-gray-500">Nenhuma foto anexada ainda.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative overflow-hidden rounded-lg border border-gray-200">
              {urls[photo.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urls[photo.id]}
                  alt={photo.file_name}
                  onClick={() => setLightbox({ url: urls[photo.id], name: photo.file_name })}
                  className="aspect-square w-full cursor-zoom-in object-cover"
                />
              ) : (
                <div className="aspect-square w-full animate-pulse bg-gray-100" />
              )}
              <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {urls[photo.id] && (
                  <a
                    href={urls[photo.id]}
                    download={photo.file_name}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-full bg-blue-900/70 p-1 text-white hover:bg-blue-900"
                    title="Baixar foto"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  onClick={() => onDeletePhoto(photo)}
                  className="rounded-full bg-blue-900/70 p-1 text-white hover:bg-blue-900"
                  title="Remover foto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <Dialog open onClose={() => setLightbox(null)} size="xl">
          <DialogHeader title={lightbox.name} onClose={() => setLightbox(null)} />
          <DialogBody className="flex items-center justify-center bg-gray-050 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.url} alt={lightbox.name} className="max-h-[70vh] w-auto rounded-lg object-contain" />
          </DialogBody>
          <DialogFooter>
            <a
              href={lightbox.url}
              download={lightbox.name}
              className="inline-flex h-10 items-center gap-1.5 rounded-[14px] bg-blue-900 px-4 text-sm font-semibold text-white hover:bg-blue-800"
            >
              <Download className="h-4 w-4" /> Baixar
            </a>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
