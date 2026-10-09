"use client";

import { useEffect, type RefObject } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

// Rolagem suave (Lenis). Duas formas de uso:
//   - useSmoothScroll(wrapper, content): o AppShell rola dentro do <main>, não
//     na janela, então o Lenis é ligado nesse contêiner (vale para todas as abas).
//   - <SmoothScroll />: rolagem da janela nas páginas fora do AppShell (login,
//     relatórios, expansão). Fica inerte quando o AppShell está na tela.
// allowNestedScroll deixa listas, modais e menus com scroll próprio rolarem
// normalmente; prefers-reduced-motion é respeitado pelo próprio Lenis.

const OPTIONS = { lerp: 0.1, wheelMultiplier: 1, allowNestedScroll: true, autoRaf: true } as const;

export function useSmoothScroll(wrapperRef: RefObject<HTMLElement | null>, contentRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return;
    const lenis = new Lenis({ ...OPTIONS, wrapper, content });
    return () => lenis.destroy();
  }, [wrapperRef, contentRef]);
}

export function SmoothScroll() {
  const pathname = usePathname();
  useEffect(() => {
    if (document.querySelector("[data-lenis-shell]")) return;
    const lenis = new Lenis(OPTIONS);
    return () => lenis.destroy();
  }, [pathname]);
  return null;
}
