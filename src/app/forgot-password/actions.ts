"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim();

  if (!email) {
    redirect("/forgot-password?error=Informe%20um%20e-mail");
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/update-password`,
  });

  // Sempre responde com sucesso, independente de o e-mail existir,
  // para que este endpoint não possa ser usado para enumerar contas.
  redirect("/forgot-password?sent=1");
}
