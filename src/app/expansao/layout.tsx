import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";
import { ExpansionHeader } from "@/components/expansion/ExpansionHeader";

export const metadata: Metadata = {
  title: "Criativos — Expansão Help Multas",
};

// Standalone dashboard for the expansion team: requires login but lives
// outside the (app) shell, so there's no sidebar into the rest of the hub.
export default async function ExpansionLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user) redirect("/login?redirectTo=/expansao");

  return (
    <div className="min-h-screen bg-gray-100/50">
      <ExpansionHeader userName={profile?.full_name ?? ""} canReturnToHub={profile?.role !== "expansao"} />
      <main className="mx-auto max-w-[1400px] p-4 lg:p-8">{children}</main>
    </div>
  );
}
