"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, ExternalLink, FileText, Folder, Link2Off, Loader2, Search } from "lucide-react";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { listTeleprompterFolders, listTeleprompterScripts } from "@/lib/services/teleprompterScripts";
import { linkAdToScript, unlinkAd } from "@/lib/services/adScriptLinks";
import { cn } from "@/lib/utils";
import type { TeleprompterFolder, TeleprompterScript } from "@/types/database";

/**
 * Escolhe de qual roteiro do Teleprompter é um anúncio. O vínculo alimenta a IA:
 * ela passa a saber quais roteiros viraram anúncios que convertem.
 */
export function ScriptLinkDialog({
  ad,
  onClose,
  onChanged,
}: {
  ad: { adId: string; adName: string; current: { id: string; title: string } | null } | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useAuth();
  const [scripts, setScripts] = useState<TeleprompterScript[]>([]);
  const [folders, setFolders] = useState<TeleprompterFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!ad) return;
    setQuery("");
    setLoading(true);
    Promise.all([listTeleprompterScripts(supabase), listTeleprompterFolders(supabase)])
      .then(([s, f]) => {
        setScripts(s);
        setFolders(f);
      })
      .catch(() => toast.error("Não foi possível carregar os roteiros"))
      .finally(() => setLoading(false));
  }, [ad, supabase]);

  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // gravados primeiro: são os que realmente foram ao ar
    return scripts
      .filter((s) => !q || s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q))
      .sort((a, b) => Number(b.is_recorded) - Number(a.is_recorded) || b.updated_at.localeCompare(a.updated_at));
  }, [scripts, query]);

  async function choose(script: TeleprompterScript) {
    if (!ad) return;
    setBusyId(script.id);
    try {
      await linkAdToScript(supabase, ad.adId, script.id, profile?.id ?? null);
      toast.success("Roteiro vinculado ao anúncio");
      onChanged();
      onClose();
    } catch {
      toast.error("Não foi possível vincular o roteiro");
    } finally {
      setBusyId(null);
    }
  }

  async function remove() {
    if (!ad) return;
    setBusyId("unlink");
    try {
      await unlinkAd(supabase, ad.adId);
      toast.success("Vínculo removido");
      onChanged();
      onClose();
    } catch {
      toast.error("Não foi possível remover o vínculo");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={!!ad} onClose={onClose} size="md">
      <DialogHeader title="Vincular roteiro" subtitle={ad?.adName} onClose={onClose} />
      <DialogBody className="space-y-3">
        <p className="rounded-xl bg-blue-050 px-3.5 py-2.5 text-xs text-blue-900/80">
          De qual roteiro é este anúncio? Com o vínculo, o Helpinho entende quais tipos de roteiro convertem e usa isso para escrever os próximos.
        </p>

        {ad?.current && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-yellow-300 bg-yellow-050 px-3.5 py-2.5">
            <FileText className="h-4 w-4 shrink-0 text-yellow-600" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-blue-900">Atual: {ad.current.title}</span>
            <Link href={`/teleprompter?roteiro=${ad.current.id}`} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-blue-800 hover:bg-white">
              Abrir <ExternalLink className="h-3 w-3" />
            </Link>
            <button
              type="button"
              onClick={remove}
              disabled={busyId === "unlink"}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger-bg)] disabled:opacity-50"
            >
              {busyId === "unlink" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2Off className="h-3 w-3" />} Remover
            </button>
          </div>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar roteiro..."
            aria-label="Buscar roteiro"
            className="h-11 w-full rounded-full border border-gray-200 bg-gray-050 pl-10 pr-3 text-blue-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-900 focus:bg-white focus:shadow-[var(--shadow-focus)]"
            style={{ fontSize: 16 }}
          />
        </div>

        <div className="max-h-[50dvh] space-y-2 overflow-y-auto pr-0.5">
          {loading ? (
            [0, 1, 2].map((i) => <div key={i} className="ast-skeleton h-16 rounded-2xl" style={{ animationDelay: `${i * 100}ms` }} />)
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              {scripts.length === 0 ? "Nenhum roteiro salvo no Teleprompter ainda." : "Nenhum roteiro encontrado."}
            </p>
          ) : (
            filtered.map((s) => {
              const folder = s.folder_id ? folderById.get(s.folder_id) : undefined;
              const current = ad?.current?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => choose(s)}
                  disabled={busyId !== null}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all active:scale-[0.99] disabled:opacity-60",
                    current ? "border-yellow-400 bg-yellow-050" : "border-gray-200 bg-white hover:border-blue-900/30 hover:shadow-[var(--shadow-sm)]"
                  )}
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-050 text-blue-800">
                    {busyId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : current ? <Check className="h-4 w-4" strokeWidth={3} /> : <FileText className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-blue-900">{s.title}</span>
                    {s.content && <span className="mt-0.5 line-clamp-2 block text-xs text-gray-500">{s.content}</span>}
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                      {s.is_recorded && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-success-bg)] px-2 py-0.5 text-[color:var(--color-success)]">
                          <Check className="h-3 w-3" /> Gravado
                        </span>
                      )}
                      {folder && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-white" style={{ backgroundColor: folder.color }}>
                          <Folder className="h-3 w-3" /> {folder.name}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </DialogBody>
    </Dialog>
  );
}
