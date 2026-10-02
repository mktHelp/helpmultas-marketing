"use client";

import { useEffect } from "react";

/**
 * Bloqueia o zoom por gesto no celular. O iOS Safari ignora `user-scalable=no`
 * desde o iOS 10, então o pinch precisa ser cancelado pelos eventos de gesto
 * (e por toques com 2+ dedos). Zoom automático ao focar campos é evitado
 * deixando inputs com fonte >= 16px (ver globals.css).
 */
export function NoPinchZoom() {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    const blockMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener("gesturestart", block);
    document.addEventListener("gesturechange", block);
    document.addEventListener("gestureend", block);
    document.addEventListener("touchmove", blockMultiTouch, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", block);
      document.removeEventListener("gesturechange", block);
      document.removeEventListener("gestureend", block);
      document.removeEventListener("touchmove", blockMultiTouch);
    };
  }, []);
  return null;
}
