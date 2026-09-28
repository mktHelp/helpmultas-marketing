"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function confirmRecovery(formData: FormData) {
  const code = String(formData.get("code") || "");
  const next = String(formData.get("next") || "/dashboard");

  if (!code) {
    redirect("/login?error=Link%20inv%C3%A1lido%20ou%20expirado");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    redirect("/login?error=Link%20inv%C3%A1lido%20ou%20expirado");
  }

  redirect(next);
}
