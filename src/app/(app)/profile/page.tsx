"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { removeAvatar, updateProfile, uploadAvatar } from "@/lib/services/profiles";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = { master: "Master", gestor: "Gestor", membro: "Membro", expansao: "Expansão" };

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
  });
  const [password, setPassword] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!profile) return null;

  async function handleFile(file: File | undefined) {
    if (!file || photoBusy) return;
    setPhotoBusy(true);
    try {
      await uploadAvatar(supabase, profile!.id, file);
      await refresh();
      toast.success("Foto de perfil atualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar a foto");
    } finally {
      setPhotoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemovePhoto() {
    if (photoBusy) return;
    setPhotoBusy(true);
    try {
      await removeAvatar(supabase, profile!.id);
      await refresh();
      toast.success("Foto removida");
    } catch {
      toast.error("Erro ao remover a foto");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile(supabase, profile!.id, form);
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
        <div className="mb-6 flex flex-wrap items-center gap-5">
          <div
            className={cn("group relative h-24 w-24 shrink-0 rounded-full transition-shadow", dragging && "ring-4 ring-yellow-500/60")}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
          >
            <UserAvatar name={profile.full_name} avatarUrl={profile.avatar_url} size="lg" className="h-24 w-24 text-2xl" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoBusy}
              aria-label="Alterar foto de perfil"
              className={cn(
                "absolute inset-0 flex items-center justify-center rounded-full bg-blue-900/60 text-white transition-opacity duration-200",
                photoBusy ? "opacity-100" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
              )}
            >
              {photoBusy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-blue-900">{profile.full_name}</p>
            <p className="text-sm text-gray-500">{ROLE_LABEL[profile.role]} · {profile.email}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="secondary" disabled={photoBusy} onClick={() => fileInputRef.current?.click()}>
                <Camera className="h-3.5 w-3.5" />
                {profile.avatar_url ? "Trocar foto" : "Adicionar foto"}
              </Button>
              {profile.avatar_url && (
                <Button type="button" size="sm" variant="ghost" disabled={photoBusy} onClick={handleRemovePhoto}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Remover
                </Button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-gray-400">JPG, PNG ou WEBP. A foto é recortada em quadrado e aparece para toda a equipe.</p>
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
          <div>
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
