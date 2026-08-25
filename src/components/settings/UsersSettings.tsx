"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, UserX, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/Dialog";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { createClient } from "@/lib/supabase/client";
import { listAllProfiles } from "@/lib/services/profiles";
import { createUserAction, deactivateUserAction, reactivateUserAction } from "@/app/(app)/settings/actions";
import type { Profile, UserRole } from "@/types/database";

const ROLE_LABEL: Record<string, string> = { master: "Master", gestor: "Gestor", membro: "Membro" };

export function UsersSettings() {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ email: string; fullName: string; role: UserRole; department: string; jobTitle: string; password: string }>({
    email: "", fullName: "", role: "membro", department: "", jobTitle: "", password: "",
  });

  async function load() {
    setProfiles(await listAllProfiles(supabase));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createUserAction(form);
      toast.success("Usuário criado com sucesso");
      setOpen(false);
      setForm({ email: "", fullName: "", role: "membro", department: "", jobTitle: "", password: "" });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar usuário");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Profile) {
    if (p.is_active) await deactivateUserAction(p.id);
    else await reactivateUserAction(p.id);
    load();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Novo usuário</Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-050 text-left text-xs font-bold uppercase text-gray-500">
              <th className="p-3">Nome</th>
              <th className="p-3">Função</th>
              <th className="p-3">Departamento</th>
              <th className="p-3">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-b border-gray-50 last:border-0">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <UserAvatar name={p.full_name} avatarUrl={p.avatar_url} size="xs" />
                    <div>
                      <p className="font-semibold text-blue-900">{p.full_name}</p>
                      <p className="text-xs text-gray-400">{p.email}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3"><Badge tone="neutral">{ROLE_LABEL[p.role]}</Badge></td>
                <td className="p-3 text-gray-700">{p.department || "-"}</td>
                <td className="p-3">
                  <Badge tone={p.is_active ? "success" : "danger"}>{p.is_active ? "Ativo" : "Inativo"}</Badge>
                </td>
                <td className="p-3">
                  <button onClick={() => toggleActive(p)} className="text-gray-400 hover:text-blue-900" title={p.is_active ? "Desativar" : "Ativar"}>
                    {p.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogHeader title="Novo Usuário" onClose={() => setOpen(false)} />
        <form onSubmit={handleCreate}>
          <DialogBody className="space-y-4">
            <div>
              <Label>Nome completo</Label>
              <Input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Senha provisória</Label>
              <Input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Função</Label>
                <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
                  <option value="membro">Membro</option>
                  <option value="gestor">Gestor</option>
                  <option value="master">Master</option>
                </Select>
              </div>
              <div>
                <Label>Departamento</Label>
                <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Cargo</Label>
              <Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Criando..." : "Criar usuário"}</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
