"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Cake, PartyPopper, Paperclip, Trash2, Plus, Pencil, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Input, Label } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  createBirthday, deleteBirthday, deleteBirthdayPhoto, getBirthdayPhotoUrl,
  listBirthdayPhotos, listBirthdays, updateBirthday, uploadBirthdayPhoto,
} from "@/lib/services/birthdays";
import {
  createWorkAnniversary, deleteWorkAnniversary, deleteWorkAnniversaryPhoto, getWorkAnniversaryPhotoUrl,
  listWorkAnniversaries, listWorkAnniversaryPhotos, updateWorkAnniversary, uploadWorkAnniversaryPhoto,
} from "@/lib/services/workAnniversaries";
import { cn, initials } from "@/lib/utils";
import type { Birthday, BirthdayPhoto, WorkAnniversary, WorkAnniversaryPhoto } from "@/types/database";

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
  const [kind, setKind] = useState<"life" | "work">("life");

  return (
    <div>
      <PageHeader
        title="Aniversários"
        description="Aniversário de vida e de casa da equipe, com data e fotos para postar nos stories."
        action={
          <Tabs
            tabs={[{ key: "life", label: "Aniversário de Vida" }, { key: "work", label: "Aniversário de Casa" }]}
            active={kind}
            onChange={(v) => setKind(v as "life" | "work")}
          />
        }
      />
      {kind === "life" ? <LifeBirthdays /> : <WorkAnniversaries />}
    </div>
  );
}

// ------------------------- Shared calendar/cards shell -------------------------

function AnniversaryBoard<T extends { id: string; name: string; notes: string | null }>({
  items, getMonthDay, getBadgeExtra, photoCounts, onSelect, onCreate, emptyLabel,
}: {
  items: T[];
  getMonthDay: (item: T) => MonthDay;
  getBadgeExtra?: (item: T) => string | null;
  photoCounts: Map<string, number>;
  onSelect: (item: T) => void;
  onCreate: () => void;
  emptyLabel: string;
}) {
  const [view, setView] = useState<"cards" | "calendar">("cards");
  const [month, setMonth] = useState(new Date());

  const sorted = useMemo(
    () => [...items].sort((a, b) => nextOccurrence(getMonthDay(a)).getTime() - nextOccurrence(getMonthDay(b)).getTime()),
    [items, getMonthDay]
  );

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const itemsForDay = (day: Date) =>
    items.filter((it) => isSameDay(occurrenceThisYear(getMonthDay(it), day.getFullYear()), day));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((it) => {
            const md = getMonthDay(it);
            const occ = nextOccurrence(md);
            const isTodayItem = isToday(occ);
            return (
              <Card
                key={it.id}
                onClick={() => onSelect(it)}
                className={cn(
                  "cursor-pointer p-5 hover:shadow-[var(--shadow-md)] transition-shadow",
                  isTodayItem && "ring-2 ring-yellow-500"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-900 font-display text-lg font-bold text-white">
                    {initials(it.name)}
                  </span>
                  <div>
                    <p className="font-display font-bold text-blue-900">{it.name}</p>
                    {it.notes && <p className="text-xs text-gray-500">{it.notes}</p>}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge tone={isTodayItem ? "accent" : "neutral"}>
                    <Cake className="mr-1 inline h-3 w-3" />
                    {formatMonthDay(md)}
                  </Badge>
                  {getBadgeExtra?.(it) && <Badge tone="info">{getBadgeExtra(it)}</Badge>}
                  {isTodayItem && <Badge tone="success">Hoje!</Badge>}
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                  <Paperclip className="h-3.5 w-3.5" />
                  {(photoCounts.get(it.id) || 0) === 0
                    ? "Sem fotos anexadas"
                    : `${photoCounts.get(it.id)} foto(s) anexada(s)`}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-center gap-2">
            <Button size="icon" variant="secondary" onClick={() => setMonth(subMonths(month, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-display text-sm font-bold text-blue-900 capitalize w-32 text-center">
              {format(month, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button size="icon" variant="secondary" onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} className="bg-blue-900 py-2 text-center text-xs font-bold text-white">{d}</div>
            ))}
            {days.map((day) => {
              const dayItems = itemsForDay(day);
              return (
                <div
                  key={day.toISOString()}
                  className={cn("min-h-[110px] bg-white p-2", !isSameMonth(day, month) && "bg-gray-050 text-gray-300")}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                      isToday(day) ? "bg-yellow-500 text-blue-900" : "text-gray-500"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayItems.map((it) => (
                      <button
                        key={it.id}
                        onClick={() => onSelect(it)}
                        className="flex w-full items-center gap-1 truncate rounded-md bg-yellow-100 px-1.5 py-0.5 text-left text-[11px] font-semibold text-blue-900 hover:bg-yellow-200"
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
        </div>
      )}
    </div>
  );
}

// ------------------------- Aniversário de Vida -------------------------

function LifeBirthdays() {
  const supabase = createClient();
  const { profile: me } = useAuth();
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [photos, setPhotos] = useState<BirthdayPhoto[]>([]);
  const [selected, setSelected] = useState<Birthday | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Birthday | null>(null);

  const load = useCallback(() => {
    listBirthdays(supabase).then(setBirthdays);
    listBirthdayPhotos(supabase).then(setPhotos);
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

  return (
    <div>
      <AnniversaryBoard
        items={birthdays}
        getMonthDay={(b) => ({ month: b.birth_month, day: b.birth_day })}
        photoCounts={photoCounts}
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
  birthday, userId, onClose, onSaved,
}: {
  birthday: Birthday | null;
  userId: string;
  onClose: () => void;
  onSaved: (b: Birthday) => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState(birthday?.name || "");
  const [month, setMonth] = useState(birthday?.birth_month || 1);
  const [day, setDay] = useState(birthday?.birth_day || 1);
  const [notes, setNotes] = useState(birthday?.notes || "");
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
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </DialogFooter>
    </Dialog>
  );
}

function LifeBirthdayDialog({
  birthday, photos, onClose, onChanged, onEdit, onDeleted, userId,
}: {
  birthday: Birthday;
  photos: BirthdayPhoto[];
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

function WorkAnniversaries() {
  const supabase = createClient();
  const { profile: me } = useAuth();
  const [items, setItems] = useState<WorkAnniversary[]>([]);
  const [photos, setPhotos] = useState<WorkAnniversaryPhoto[]>([]);
  const [selected, setSelected] = useState<WorkAnniversary | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WorkAnniversary | null>(null);

  const load = useCallback(() => {
    listWorkAnniversaries(supabase).then(setItems);
    listWorkAnniversaryPhotos(supabase).then(setPhotos);
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
  item, userId, onClose, onSaved,
}: {
  item: WorkAnniversary | null;
  userId: string;
  onClose: () => void;
  onSaved: (w: WorkAnniversary) => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState(item?.name || "");
  const [hireDate, setHireDate] = useState(item?.hire_date || "");
  const [notes, setNotes] = useState(item?.notes || "");
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
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </DialogFooter>
    </Dialog>
  );
}

function WorkAnniversaryDialog({
  item, years, photos, onClose, onChanged, onEdit, onDeleted, userId,
}: {
  item: WorkAnniversary;
  years: number;
  photos: WorkAnniversaryPhoto[];
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
