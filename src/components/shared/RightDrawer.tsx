"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Gaveta que desliza da direita, com fundo escurecido. Os filhos só são
 * montados enquanto aberta, então o conteúdo (ex.: rascunho de filtros)
 * recomeça do zero a cada abertura. Esc ou clique no fundo fecham.
 */
export function RightDrawer({
  open,
  onClose,
  label,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  /** gaveta larga (leitura de textos longos) */
  wide?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  // Portal no body: dentro de um ancestral com transform/animação o "fixed" vira relativo a ele
  // e a gaveta ficava do tamanho da página inteira (scroll quase infinito).
  return createPortal(
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={label}>
      <button
        type="button"
        aria-label={`Fechar ${label.toLowerCase()}`}
        className="absolute inset-0 bg-blue-900/40 backdrop-blur-[1px]"
        style={{ animation: "overlay-fade-in 200ms ease-out both" }}
        onClick={onClose}
      />
      <div className={`sb-drawer-in-right absolute inset-y-0 right-0 w-[92%] bg-white shadow-[var(--shadow-lg)] ${wide ? "max-w-xl" : "max-w-sm"}`}>{children}</div>
    </div>,
    document.body
  );
}
