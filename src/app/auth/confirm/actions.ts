"use server";

import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function confirmRecovery(formData: FormData) {
  const token_hash = String(formData.get("token_hash") || "");
  const type = String(formData.get("type") || "") as EmailOtpType;
  const next = String(formData.get("next") || "/dashboard");

  if (!token_hash || !type) {
    redirect("/login?error=Link%20inv%C3%A1lido%20ou%20expirado");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    redirect("/login?error=Link%20inv%C3%A1lido%20ou%20expirado");
  }

  redirect(next);
}
