"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export const FOLDER_COLORS = ["#fcbf00", "#3b82f6", "#10b981", "#ec4899", "#8b5cf6", "#f97316", "#06b6d4", "#ef4444"];

/** Criar ou renomear uma pasta de roteiros. `initial` presente = edição. */
export function FolderDialog({
  open,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial?: { name: string; color: string } | null;
  onClose: () => void;
  onSubmit: (value: { name: string; color: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(FOLDER_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setColor(initial?.color ?? FOLDER_COLORS[0]);
    setSaving(false);
  }, [open, initial]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onSubmit({ name: trimmed, color });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} size="sm">
      <DialogHeader title={initial ? "Editar pasta" : "Nova pasta"} subtitle="Agrupe roteiros por série, campanha ou perfil." onClose={onClose} />
      <form onSubmit={submit}>
        <DialogBody className="space-y-4">
          <div>
            <Label htmlFor="folder-name">Nome da pasta</Label>
            <Input
              id="folder-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Ex: Reels de recurso, Série franquia…"
              style={{ fontSize: 16 }}
            />
          </div>
          <div>
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Cor ${c}`}
                  aria-pressed={color === c}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95",
                    color === c && "ring-2 ring-blue-900 ring-offset-2"
                  )}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="ast-pop h-4 w-4 text-white" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!name.trim() || saving}>
            {saving ? "Salvando..." : initial ? "Salvar" : "Criar pasta"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
