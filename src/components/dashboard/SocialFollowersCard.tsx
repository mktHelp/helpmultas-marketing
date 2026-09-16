"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AtSign, Pencil, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { addFollowerSnapshot } from "@/lib/services/social";
import { socialFollowerDeltas } from "@/lib/stats";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { SocialAccount, SocialFollowerSnapshot } from "@/types/database";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function SocialFollowersCard({
  accounts,
  snapshots,
  canManage,
}: {
  accounts: SocialAccount[];
  snapshots: SocialFollowerSnapshot[];
  canManage: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { profile } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const rows = socialFollowerDeltas(accounts, snapshots);

  async function handleSave(accountId: string) {
    if (!profile || !value) return;
    setSaving(true);
    try {
      await addFollowerSnapshot(supabase, {
        account_id: accountId,
        followers_count: Number(value),
        created_by: profile.id,
        source: "manual",
      });
      toast.success("Seguidores atualizados");
      setEditingId(null);
      setValue("");
      router.refresh();
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <h3 className="font-display text-[17px] font-semibold text-blue-900">Seguidores</h3>
      <p className="mt-0.5 text-xs text-gray-500">Instagram · variação diária</p>

      {accounts.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 py-6 text-center">
          <Users className="h-6 w-6 text-gray-300" />
          <p className="text-sm text-gray-400">Nenhum perfil configurado.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {rows.map(({ account, latest, delta }) => (
            <div key={account.id} className="rounded-xl bg-gray-050 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AtSign className="h-4 w-4 text-gray-400" />
                  <p className="text-sm font-semibold text-blue-900">{account.label}</p>
                </div>
                {canManage && editingId !== account.id && (
                  <button
                    onClick={() => {
                      setEditingId(account.id);
                      setValue(latest ? String(latest.followers_count) : "");
                    }}
                    className="rounded p-1 text-gray-400 hover:text-blue-900"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </div>

              {editingId === account.id ? (
                <div className="mt-2 flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="mb-1">Seguidores hoje</Label>
                    <Input
                      type="number"
                      min={0}
                      autoFocus
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSave(account.id)}
                    />
                  </div>
                  <Button type="button" onClick={() => handleSave(account.id)} disabled={saving || !value}>
                    Salvar
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancelar
                  </Button>
                </div>
              ) : latest ? (
                <>
                  <div className="mt-1.5 flex items-baseline gap-3">
                    <span className="text-xl font-bold text-blue-900">{latest.followers_count.toLocaleString("pt-BR")}</span>
                    {delta !== null && (
                      <span
                        className={cn(
                          "flex items-center gap-1 text-xs font-bold",
                          delta > 0 ? "text-[color:var(--color-success)]" : delta < 0 ? "text-[color:var(--color-danger)]" : "text-gray-400"
                        )}
                      >
                        {delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : delta < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : null}
                        {delta > 0 ? "+" : ""}
                        {delta} desde ontem
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">
                    Atualizado às {formatTime(latest.captured_at)}
                    {latest.source !== "manual" && " · automático"}
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-xs text-gray-400">
                  {canManage ? "Sem registro ainda — clique no lápis para adicionar." : "Sem registro ainda."}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
