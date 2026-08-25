"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Card } from "@/components/ui/Card";
import { UsersSettings } from "@/components/settings/UsersSettings";
import { AreasSettings } from "@/components/settings/AreasSettings";
import { TagsSettings } from "@/components/settings/TagsSettings";
import { StatusesSettings } from "@/components/settings/StatusesSettings";
import { useAuth } from "@/lib/auth-context";

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState("users");

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Configurações" description="Acesso restrito ao Master." />
        <Card className="p-8 text-center text-sm text-gray-500">
          Apenas o usuário Master pode acessar as configurações do sistema.
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Configurações" description="Gerencie usuários, etapas, áreas, categorias e tags do sistema." />

      <div className="mb-5">
        <Tabs
          tabs={[
            { key: "users", label: "Usuários" },
            { key: "statuses", label: "Etapas" },
            { key: "areas", label: "Áreas & Categorias" },
            { key: "tags", label: "Tags" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      <Card className="p-6">
        {tab === "users" && <UsersSettings />}
        {tab === "statuses" && <StatusesSettings />}
        {tab === "areas" && <AreasSettings />}
        {tab === "tags" && <TagsSettings />}
      </Card>
    </div>
  );
}
