"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "master") throw new Error("Apenas o Master pode gerenciar usuários");
}

export async function createUserAction(input: {
  email: string;
  fullName: string;
  role: UserRole;
  department?: string;
  jobTitle?: string;
  password: string;
  /** null = acesso padrão do papel */
  allowedTabs?: string[] | null;
}) {
  await assertAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
      role: input.role,
      department: input.department,
      job_title: input.jobTitle,
      allowed_tabs: input.role === "master" ? null : (input.allowedTabs ?? null),
    },
  });

  if (error) throw new Error(error.message);
  return data.user;
}

export async function updateUserTabsAction(userId: string, allowedTabs: string[] | null) {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ allowed_tabs: allowedTabs }).eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function deactivateUserAction(userId: string) {
  await assertAdmin();
  const admin = createAdminClient();
  await admin.from("profiles").update({ is_active: false }).eq("id", userId);
}

export async function reactivateUserAction(userId: string) {
  await assertAdmin();
  const admin = createAdminClient();
  await admin.from("profiles").update({ is_active: true }).eq("id", userId);
}

export async function deleteUserAction(userId: string) {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}
