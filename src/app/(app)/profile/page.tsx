"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { updateProfile } from "@/lib/services/profiles";

const ROLE_LABEL: Record<string, string> = { master: "Master", gestor: "Gestor", membro: "Membro" };

export default function ProfilePage() {
  const { profile, refresh } = useAuth();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: profile?.full_name || "",
    phone: profile?.phone || "",
    job_title: profile?.job_title || "",
    department: profile?.department || "",
    birth_date: profile?.birth_date || "",
  });
  const [password, setPassword] = useState("");

  if (!profile) return null;

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile(supabase, profile!.id, { ...form, birth_date: form.birth_date || null });
      await refresh();
      toast.success("Perfil atualizado");
    } catch {
      toast.error("Erro ao atualizar perfil");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres");
      return;
    }
    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha alterada com sucesso");
      setPassword("");
    } catch {
      toast.error("Erro ao alterar senha");
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Meu Perfil" description="Gerencie suas informações pessoais e preferências." />

      <Card className="p-6">
        <div className="mb-5 flex items-center gap-4">
          <UserAvatar name={profile.full_name} avatarUrl={profile.avatar_url} size="lg" />
          <div>
            <p className="font-display font-bold text-blue-900">{profile.full_name}</p>
            <p className="text-sm text-gray-500">{ROLE_LABEL[profile.role]} · {profile.email}</p>
          </div>
        </div>

        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <Label>Nome completo</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cargo</Label>
              <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
            </div>
            <div>
              <Label>Departamento</Label>
              <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Data de aniversário</Label>
              <Input
                type="date"
                value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              />
            </div>
          </div>
          <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
        </form>
      </Card>

      <Card className="p-6">
        <h3 className="mb-3 font-display text-sm font-bold text-blue-900">Alterar senha</h3>
        <form onSubmit={changePassword} className="flex items-end gap-3">
          <div className="flex-1">
            <Label>Nova senha</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button type="submit" variant="secondary" disabled={passwordSaving}>
            {passwordSaving ? "Alterando..." : "Alterar senha"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
