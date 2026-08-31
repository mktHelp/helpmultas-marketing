"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Cake, Paperclip, Trash2, Plus, Pencil } from "lucide-react";
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
import { cn, initials } from "@/lib/utils";
import type { Birthday, BirthdayPhoto } from "@/types/database";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function birthdayThisYear(b: Pick<Birthday, "birth_month" | "birth_day">, referenceYear: number) {
  return new Date(referenceYear, b.birth_month - 1, b.birth_day);
}

function nextOccurrence(b: Pick<Birthday, "birth_month" | "birth_day">) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let occ = birthdayThisYear(b, now.getFullYear());
  if (occ < now) occ = birthdayThisYear(b, now.getFullYear() + 1);
  return occ;
}

function formatBirthDate(b: Pick<Birthday, "birth_month" | "birth_day">) {
  return `${String(b.birth_day).padStart(2, "0")} de ${MONTH_NAMES[b.birth_month - 1]}`;
}

export default function BirthdaysPage() {
  const supabase = createClient();
  const { profile: me } = useAuth();
  const [view, setView] = useState<"cards" | "calendar">("cards");
  const [month, setMonth] = useState(new Date());
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

  const photosByBirthday = useMemo(() => {
    const map = new Map<string, BirthdayPhoto[]>();
    for (const p of photos) {
      if (!map.has(p.birthday_id)) map.set(p.birthday_id, []);
      map.get(p.birthday_id)!.push(p);
    }
    return map;
  }, [photos]);

  const sorted = useMemo(() => {
    return [...birthdays].sort(
      (a, b) => nextOccurrence(a).getTime() - nextOccurrence(b).getTime()
    );
  }, [birthdays]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const birthdaysForDay = (day: Date) =>
    birthdays.filter((b) => isSameDay(birthdayThisYear(b, day.getFullYear()), day));

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(b: Birthday) {
    setEditing(b);
    setFormOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Aniversários"
        description="Aniversariantes da rede, com data e fotos para postar nos stories."
        action={
          <div className="flex items-center gap-2">
            <Tabs
              tabs={[{ key: "cards", label: "Cards" }, { key: "calendar", label: "Calendário" }]}
              active={view}
              onChange={(v) => setView(v as "cards" | "calendar")}
            />
            <Button onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo aniversário
            </Button>
          </div>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          icon={Cake}
          title="Nenhum aniversário cadastrado"
          description="Clique em 'Novo aniversário' para adicionar o primeiro."
          actionLabel="Novo aniversário"
          onAction={openCreate}
        />
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((b) => (
            <BirthdayCard
              key={b.id}
              birthday={b}
              photoCount={photosByBirthday.get(b.id)?.length || 0}
              onClick={() => setSelected(b)}
            />
          ))}
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
              const dayBirthdays = birthdaysForDay(day);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[110px] bg-white p-2",
                    !isSameMonth(day, month) && "bg-gray-050 text-gray-300"
                  )}
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
                    {dayBirthdays.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => setSelected(b)}
                        className="flex w-full items-center gap-1 truncate rounded-md bg-yellow-100 px-1.5 py-0.5 text-left text-[11px] font-semibold text-blue-900 hover:bg-yellow-200"
                      >
                        <Cake className="h-3 w-3 shrink-0" />
                        <span className="truncate">{b.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected && (
        <BirthdayDialog
          birthday={selected}
          photos={photosByBirthday.get(selected.id) || []}
          onClose={() => setSelected(null)}
          onChanged={load}
          onEdit={() => openEdit(selected)}
          onDeleted={() => {
            setSelected(null);
            load();
          }}
          userId={me?.id || ""}
        />
      )}

      {formOpen && (
        <BirthdayFormDialog
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

function BirthdayCard({
  birthday, photoCount, onClick,
}: {
  birthday: Birthday;
  photoCount: number;
  onClick: () => void;
}) {
  const occ = nextOccurrence(birthday);
  const isTodayBirthday = isToday(occ);

  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer p-5 hover:shadow-[var(--shadow-md)] transition-shadow",
        isTodayBirthday && "ring-2 ring-yellow-500"
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-900 font-display text-lg font-bold text-white">
          {initials(birthday.name)}
        </span>
        <div>
          <p className="font-display font-bold text-blue-900">{birthday.name}</p>
          {birthday.notes && <p className="text-xs text-gray-500">{birthday.notes}</p>}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Badge tone={isTodayBirthday ? "accent" : "neutral"}>
          <Cake className="mr-1 inline h-3 w-3" />
          {formatBirthDate(birthday)}
        </Badge>
        {isTodayBirthday && <Badge tone="success">Hoje!</Badge>}
      </div>
      <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
        <Paperclip className="h-3.5 w-3.5" />
        {photoCount === 0 ? "Sem fotos anexadas" : `${photoCount} foto(s) anexada(s)`}
      </div>
    </Card>
  );
}

function BirthdayFormDialog({
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

  const daysInMonth = DAYS_IN_MONTH[month - 1];

  return (
    <Dialog open onClose={onClose} size="sm">
      <DialogHeader title={birthday ? "Editar aniversário" : "Novo aniversário"} onClose={onClose} />
      <DialogBody className="space-y-4">
        <div>
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do colaborador" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Dia</Label>
            <Select
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
            >
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

function BirthdayDialog({
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
        photos.map(async (p) => [p.id, await getBirthdayPhotoUrl(supabase, p.file_path)] as const)
      );
      setUrls(Object.fromEntries(entries));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadBirthdayPhoto(supabase, birthday.id, userId, file);
      }
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
          subtitle={`Aniversário em ${formatBirthDate(birthday)}`}
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

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-sm font-bold text-blue-900">Fotos para o story</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />
              <Button size="sm" variant="secondary" disabled={uploading} onClick={() => fileRef.current?.click()}>
                <Paperclip className="mr-1.5 h-4 w-4" />
                {uploading ? "Enviando..." : "Anexar foto"}
              </Button>
            </div>

            {photos.length === 0 ? (
              <p className="rounded-lg bg-gray-050 p-4 text-center text-sm text-gray-500">
                Nenhuma foto anexada ainda.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo) => (
                  <div key={photo.id} className="group relative overflow-hidden rounded-lg border border-gray-200">
                    {urls[photo.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={urls[photo.id]} alt={photo.file_name} className="aspect-square w-full object-cover" />
                    ) : (
                      <div className="aspect-square w-full animate-pulse bg-gray-100" />
                    )}
                    <button
                      onClick={() => handleDeletePhoto(photo)}
                      className="absolute right-1 top-1 rounded-full bg-blue-900/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      title="Remover foto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
