"use client";

import { Dialog, DialogBody, DialogFooter, DialogHeader } from "./Dialog";
import { Button } from "./Button";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  danger = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} size="sm">
      <DialogHeader title={title} onClose={onClose} />
      <DialogBody>
        <p className="text-sm text-gray-700">{description}</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant={danger ? "danger" : "dark"} onClick={onConfirm} disabled={loading}>
          {loading ? "Aguarde..." : confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
