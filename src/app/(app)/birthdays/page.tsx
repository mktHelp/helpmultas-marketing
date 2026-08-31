"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Cake, Paperclip, Trash2, Check } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Input, Label } from "@/components/ui/Input";
import { Dialog, DialogHeader, DialogBody } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { listProfiles, updateProfile } from "@/lib/services/profiles";
import {
  deleteBirthdayPhoto, getBirthdayPhotoUrl, listBirthdayPhotos, uploadBirthdayPhoto,
} from "@/lib/services/birthdays";
import { cn } from "@/lib/utils";
import type { BirthdayPhoto, Profile } from "@/types/database";

function birthdayThisYear(birthDate: string, referenceYear: number) {
  const [, m, d] = birthDate.split("-").map(Number);
  return new Date(referenceYear, m - 1, d);
}

function nextOccurrence(birthDate: string) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let occ = birthdayThisYear(birthDate, now.getFullYear());
  if (occ < now) occ = birthdayThisYear(birthDate, now.getFullYear() + 1);
  return occ;
}

export default function BirthdaysPage() {
  const supabase = createClient();
  const { profile: me, isAdmin } = useAuth();
  const [view, setView] = useState<"cards" | "calendar">("cards");
  const [month, setMonth] = useState(new Date());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [photos, setPhotos] = useState<BirthdayPhoto[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);

  const load = useCallback(() => {
    listProfiles(supabase).then(setProfiles);
    listBirthdayPhotos(supabase).then(setPhotos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function canEdit(p: Profile) {
    return isAdmin || p.id === me?.id;
  }

  async function saveBirthDate(p: Profile, birthDate: string) {
    try {
      const updated = await updateProfile(supabase, p.id, { birth_date: birthDate || null });
      toast.success("Data de aniversário salva");
      setSelected((s) => (s && s.id === p.id ? updated : s));
      load();
    } catch {
      toast.error("Erro ao salvar data");
    }
  }

  const photosByProfile = useMemo(() => {
    const map = new Map<string, BirthdayPhoto[]>();
    for (const p of photos) {
      if (!map.has(p.profile_id)) map.set(p.profile_id, []);
      map.get(p.profile_id)!.push(p);
    }
    return map;
  }, [photos]);

  const sorted = useMemo(() => {
    return [...profiles]
      .filter((p) => p.birth_date)
      .sort((a, b) => nextOccurrence(a.birth_date!).getTime() - nextOccurrence(b.birth_date!).getTime());
  }, [profiles]);

  const pending = useMemo(
    () => profiles.filter((p) => !p.birth_date && canEdit(p)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profiles, isAdmin, me?.id]
  );

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const profilesForDay = (day: Date) =>
    profiles.filter((p) => p.birth_date && isSameDay(birthdayThisYear(p.birth_date, day.getFullYear()), day));

  return (
    <div>
      <PageHeader
        title="Aniversários"
        description="Datas de aniversário do time e fotos usadas nos stories."
        action={<Tabs tabs={[{ key: "cards", label: "Cards" }, { key: "calendar", label: "Calendário" }]} active={view} onChange={(v) => setView(v as "cards" | "calendar")} />}
      />

      {pending.length > 0 && (
        <Card className="mb-4 p-4">
          <p className="mb-3 font-display text-sm font-bold text-blue-900">
            Cadastrar data de aniversário
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((p) => (
              <PendingBirthdayRow key={p.id} profile={p} onSave={(date) => saveBirthDate(p, date)} />
            ))}
          </div>
        </Card>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          icon={Cake}
          title="Nenhum aniversário cadastrado"
          description="Cadastre a data de aniversário de cada colaborador acima."
        />
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((p) => (
            <BirthdayCard
              key={p.id}
              profile={p}
              photoCount={photosByProfile.get(p.id)?.length || 0}
              onClick={() => setSelected(p)}
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
              const dayProfiles = profilesForDay(day);
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
                    {dayProfiles.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelected(p)}
                        className="flex w-full items-center gap-1 truncate rounded-md bg-yellow-100 px-1.5 py-0.5 text-left text-[11px] font-semibold text-blue-900 hover:bg-yellow-200"
                      >
                        <Cake className="h-3 w-3 shrink-0" />
                        <span className="truncate">{p.full_name}</span>
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
          profile={selected}
          photos={photosByProfile.get(selected.id) || []}
          onClose={() => setSelected(null)}
          onChanged={load}
          userId={me?.id || ""}
          canEdit={canEdit(selected)}
          onSaveDate={(date) => saveBirthDate(selected, date)}
        />
      )}
    </div>
  );
}

function PendingBirthdayRow({ profile, onSave }: { profile: Profile; onSave: (date: string) => void }) {
  const [date, setDate] = useState("");
  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-050 p-2.5">
      <UserAvatar name={profile.full_name} avatarUrl={profile.avatar_url} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-blue-900">{profile.full_name}</p>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 h-8 text-xs" />
      </div>
      <Button size="icon" variant="secondary" disabled={!date} onClick={() => onSave(date)}>
        <Check className="h-4 w-4" />
      </Button>
    </div>
  );
}

function BirthdayCard({ profile, photoCount, onClick }: { profile: Profile; photoCount: number; onClick: () => void }) {
  const occ = nextOccurrence(profile.birth_date!);
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
        <UserAvatar name={profile.full_name} avatarUrl={profile.avatar_url} size="lg" />
        <div>
          <p className="font-display font-bold text-blue-900">{profile.full_name}</p>
          <p className="text-xs text-gray-500">{profile.job_title || profile.department || ""}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Badge tone={isTodayBirthday ? "accent" : "neutral"}>
          <Cake className="mr-1 inline h-3 w-3" />
          {format(occ, "dd 'de' MMMM", { locale: ptBR })}
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

function BirthdayDialog({
  profile, photos, onClose, onChanged, userId, canEdit, onSaveDate,
}: {
  profile: Profile;
  photos: BirthdayPhoto[];
  onClose: () => void;
  onChanged: () => void;
  userId: string;
  canEdit: boolean;
  onSaveDate: (date: string) => void;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [date, setDate] = useState(profile.birth_date || "");
  const occ = profile.birth_date ? nextOccurrence(profile.birth_date) : null;

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
        await uploadBirthdayPhoto(supabase, profile.id, userId, file);
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

  async function handleDelete(photo: BirthdayPhoto) {
    try {
      await deleteBirthdayPhoto(supabase, photo.id, photo.file_path);
      toast.success("Foto removida");
      onChanged();
    } catch {
      toast.error("Erro ao remover foto");
    }
  }

  return (
    <Dialog open onClose={onClose} size="lg">
      <DialogHeader
        title={profile.full_name}
        subtitle={occ ? `Aniversário em ${format(occ, "dd 'de' MMMM", { locale: ptBR })}` : "Sem data cadastrada"}
        onClose={onClose}
      />
      <DialogBody className="space-y-4">
        <div className="flex items-center gap-3">
          <UserAvatar name={profile.full_name} avatarUrl={profile.avatar_url} size="lg" />
          <div>
            <p className="font-display font-bold text-blue-900">{profile.full_name}</p>
            <p className="text-xs text-gray-500">{profile.job_title || profile.department || ""}</p>
          </div>
        </div>

        {canEdit && (
          <div>
            <Label>Data de aniversário</Label>
            <div className="flex gap-2">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Button
                variant="secondary"
                disabled={date === (profile.birth_date || "")}
                onClick={() => onSaveDate(date)}
              >
                Salvar
              </Button>
            </div>
          </div>
        )}

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
                    onClick={() => handleDelete(photo)}
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
  );
}
