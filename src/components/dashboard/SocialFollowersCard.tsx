"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AtSign, MousePointerClick, Pencil, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { addFollowerSnapshot } from "@/lib/services/social";
import { socialFollowerDeltas, socialLinkClickCounts } from "@/lib/stats";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { SocialFollowerHistoryModal } from "@/components/dashboard/SocialFollowerHistoryModal";
import type { SocialAccount, SocialFollowerSnapshot, SocialLinkClick } from "@/types/database";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

interface ProfileInfo {
  username?: string;
  name?: string;
  profile_picture_url?: string;
}

// Foto do perfil do Instagram (a URL expira; sem foto ou com erro, mostra as iniciais).
function AccountAvatar({ url, label }: { url?: string; label: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-900 text-sm font-bold text-white ring-2 ring-yellow-500">
      {url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        label.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()
      )}
    </div>
  );
}

export function SocialFollowersCard({
  accounts,
  snapshots,
  linkClicks,
  profiles = {},
  canManage,
}: {
  accounts: SocialAccount[];
  snapshots: SocialFollowerSnapshot[];
  linkClicks: SocialLinkClick[];
  profiles?: Record<string, ProfileInfo>;
  canManage: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { profile } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [historyAccount, setHistoryAccount] = useState<SocialAccount | null>(null);

  const rows = socialFollowerDeltas(accounts, snapshots);
  const clickCounts = socialLinkClickCounts(accounts, linkClicks);
  const clicksByAccount = new Map(clickCounts.map((c) => [c.account.id, c]));

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
          {rows.map(({ account, latest, delta, hourAgo }) => (
            <div
              key={account.id}
              onClick={() => editingId !== account.id && setHistoryAccount(account)}
              className={cn(
                "rounded-xl bg-gray-050 p-3 transition-colors",
                editingId !== account.id && "cursor-pointer hover:bg-gray-100"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <AccountAvatar url={profiles[account.id]?.profile_picture_url} label={account.label} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-blue-900">{account.label}</p>
                    <p className="flex items-center gap-1 text-xs text-gray-500">
                      <AtSign className="h-3 w-3" />
                      {profiles[account.id]?.username ?? account.ig_username ?? "—"}
                    </p>
                  </div>
                </div>
                {canManage && editingId !== account.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
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
                <div className="mt-2 flex items-end gap-2" onClick={(e) => e.stopPropagation()}>
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
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <div className="flex items-baseline gap-3">
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
                  </div>
                  {account.link_slug && (
                    <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-white/70 px-2.5 py-2" title="Cliques no link da bio rastreados pela landing page">
                      <MousePointerClick className="h-4 w-4 shrink-0 text-[#25d366]" />
                      <span className="text-xs font-semibold text-gray-600">Cliques na LP</span>
                      <span className="ml-auto flex items-center gap-1.5 text-xs">
                        <span className="rounded-full bg-[#25d366] px-2 py-0.5 font-bold text-white">
                          {clicksByAccount.get(account.id)?.today ?? 0} hoje
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-bold text-blue-900">
                          {clicksByAccount.get(account.id)?.total ?? 0} em 30 dias
                        </span>
                      </span>
                    </div>
                  )}
                  <p className="mt-1.5 text-[11px] text-gray-400">
                    Atualizado às {formatTime(latest.captured_at)}
                    {latest.source !== "manual" && " · automático"}
                  </p>
                  {hourAgo && hourAgo.id !== latest.id && (
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      Há 1h ({formatTime(hourAgo.captured_at)}): {hourAgo.followers_count.toLocaleString("pt-BR")}
                    </p>
                  )}
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

      <SocialFollowerHistoryModal account={historyAccount} onClose={() => setHistoryAccount(null)} />
    </Card>
  );
}
