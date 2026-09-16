import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full" suppressHydrationWarning>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
