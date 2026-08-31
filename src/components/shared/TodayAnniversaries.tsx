"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cake, PartyPopper } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { listBirthdayOwners, listBirthdays } from "@/lib/services/birthdays";
import { listWorkAnniversaryOwners, listWorkAnniversaries } from "@/lib/services/workAnniversaries";

interface TodayItem {
  id: string;
  name: string;
  kind: "life" | "work";
  extra: string | null;
  isMine: boolean;
}

export function TodayAnniversaries({ onlyMine = false }: { onlyMine?: boolean }) {
  const supabase = createClient();
  const { profile } = useAuth();
  const [items, setItems] = useState<TodayItem[] | null>(null);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();

      const [birthdays, workAnniversaries, birthdayOwners, workOwners] = await Promise.all([
        listBirthdays(supabase),
        listWorkAnniversaries(supabase),
        listBirthdayOwners(supabase),
        listWorkAnniversaryOwners(supabase),
      ]);

      const life: TodayItem[] = birthdays
        .filter((b) => b.birth_month === month && b.birth_day === day)
        .map((b) => ({
          id: b.id,
          name: b.name,
          kind: "life",
          extra: null,
          isMine: birthdayOwners.some((o) => o.birthday_id === b.id && o.profile_id === profile?.id),
        }));

      const work: TodayItem[] = workAnniversaries
        .filter((w) => {
          const [, m, d] = w.hire_date.split("-").map(Number);
          return m === month && d === day;
        })
        .map((w) => {
          const [y] = w.hire_date.split("-").map(Number);
          const years = now.getFullYear() - y;
          return {
            id: w.id,
            name: w.name,
            kind: "work" as const,
            extra: years > 0 ? `${years} ano(s) de empresa` : null,
            isMine: workOwners.some((o) => o.work_anniversary_id === w.id && o.profile_id === profile?.id),
          };
        });

      setItems([...life, ...work]);
    })();
  }, [supabase, profile?.id]);

  const visible = (items || []).filter((it) => !onlyMine || it.isMine);

  if (items === null || visible.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-[17px] font-semibold text-blue-900">
          <Cake className="h-5 w-5 text-yellow-600" /> Aniversários de hoje
        </h3>
        <Link href="/birthdays" className="text-xs font-semibold text-blue-800 hover:underline">
          Ver todos
        </Link>
      </div>
      <div className="mt-3 space-y-2">
        {visible.map((it) => (
          <Link
            key={`${it.kind}-${it.id}`}
            href="/birthdays"
            className="flex items-center justify-between rounded-lg bg-yellow-050 px-3 py-2 hover:bg-yellow-100"
          >
            <div className="flex items-center gap-2">
              {it.kind === "life" ? (
                <Cake className="h-4 w-4 text-blue-900" />
              ) : (
                <PartyPopper className="h-4 w-4 text-blue-900" />
              )}
              <span className="text-sm font-semibold text-blue-900">{it.name}</span>
            </div>
            {it.extra ? (
              <Badge tone="info">{it.extra}</Badge>
            ) : (
              <Badge tone="accent">{it.kind === "life" ? "Vida" : "Casa"}</Badge>
            )}
          </Link>
        ))}
      </div>
    </Card>
  );
}
