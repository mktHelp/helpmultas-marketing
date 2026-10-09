import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { MetaSyncProvider } from "@/lib/meta-sync-context";
import { InstagramSyncProvider } from "@/lib/instagram-sync-context";
import { SyncStatusWidgets } from "@/components/ads/SyncStatusWidgets";
import { NoPinchZoom } from "@/components/shared/NoPinchZoom";
import { SmoothScroll } from "@/components/shared/SmoothScroll";
import "lenis/dist/lenis.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marketing Hub — Help Multas",
  description: "Sistema de gestão de tarefas do time de Marketing da Help Multas",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Marketing Hub",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c1e3e",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  // Sem zoom no celular (nem pinça nem o zoom automático ao focar num campo).
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full" suppressHydrationWarning>
        <NoPinchZoom />
        <SmoothScroll />
        <MetaSyncProvider>
          <InstagramSyncProvider>
            {children}
            <SyncStatusWidgets />
          </InstagramSyncProvider>
        </MetaSyncProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
