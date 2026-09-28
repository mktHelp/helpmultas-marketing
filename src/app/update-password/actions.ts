"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (password.length < 8) {
    redirect("/update-password?error=A%20senha%20deve%20ter%20ao%20menos%208%20caracteres");
  }

  if (password !== confirmPassword) {
    redirect("/update-password?error=As%20senhas%20n%C3%A3o%20coincidem");
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Sua%20sess%C3%A3o%20expirou%2C%20solicite%20um%20novo%20link");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/update-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}
