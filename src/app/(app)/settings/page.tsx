"use client";

import { useState } from "react";
import { Columns3, FolderTree, ShieldAlert, Tags, Users, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { UsersSettings } from "@/components/settings/UsersSettings";
import { AreasSettings } from "@/components/settings/AreasSettings";
import { TagsSettings } from "@/components/settings/TagsSettings";
import { StatusesSettings } from "@/components/settings/StatusesSettings";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

interface SettingsTab {
  key: "users" | "statuses" | "areas" | "tags";
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

const TABS: SettingsTab[] = [
  { key: "users", label: "Usuários", title: "Usuários e permissões", description: "Quem tem acesso ao Hub e com qual perfil.", icon: Users, color: "#4a6a80" },
  { key: "statuses", label: "Etapas", title: "Etapas do fluxo", description: "As colunas do quadro, na ordem e com as cores de cada etapa.", icon: Columns3, color: "#e0a900" },
  { key: "areas", label: "Áreas & Categorias", title: "Áreas e categorias", description: "Os times e as classificações usadas para organizar as tarefas.", icon: FolderTree, color: "#2f8f5b" },
  { key: "tags", label: "Tags", title: "Tags", description: "Marcadores coloridos para filtrar e identificar tarefas.", icon: Tags, color: "#8b5cf6" },
];

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<SettingsTab["key"]>("users");

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Configurações" description="Acesso restrito ao Master." />
        <Card className="ast-fade-up flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <p className="max-w-sm text-sm text-gray-500">Apenas o usuário Master pode acessar as configurações do sistema.</p>
        </Card>
      </div>
    );
  }

  const current = TABS.find((t) => t.key === tab) ?? TABS[0];
  const CurrentIcon = current.icon;

  return (
    <div>
      <PageHeader title="Configurações" description="Gerencie usuários, etapas, áreas, categorias e tags do sistema." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
        {/* Navegação: lista vertical no desktop, faixa rolável no celular */}
        <nav aria-label="Seções de configuração" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t, i) => {
            const Icon = t.icon;
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={active ? "page" : undefined}
                style={{ animationDelay: `${i * 60}ms`, borderColor: active ? t.color : undefined }}
                className={cn(
                  "ast-fade-up group relative flex shrink-0 items-center gap-3 overflow-hidden rounded-2xl border bg-white px-3.5 py-3 text-left shadow-[var(--shadow-sm)] transition-all duration-200 lg:shrink",
                  active ? "border-2 shadow-[var(--shadow-md)]" : "border-gray-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-[var(--shadow-md)]"
                )}
              >
                <span className="absolute inset-y-0 left-0 w-1 transition-all duration-200" style={{ backgroundColor: t.color, opacity: active ? 1 : 0 }} aria-hidden />
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6"
                  style={{ backgroundColor: active ? t.color : `${t.color}1f`, color: active ? "#fff" : t.color }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block whitespace-nowrap font-display text-sm font-bold text-blue-900">{t.label}</span>
                  <span className="hidden text-[11px] text-gray-500 lg:block">{t.description.split(".")[0]}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <Card className="min-w-0 overflow-hidden p-0">
          <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4" style={{ background: `linear-gradient(90deg, ${current.color}14, transparent)` }}>
            <span key={current.key} className="ast-pop flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ backgroundColor: current.color }}>
              <CurrentIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-blue-900">{current.title}</h2>
              <p className="text-xs text-gray-500">{current.description}</p>
            </div>
          </div>
          <div key={current.key} className="ast-fade-up p-6">
            {tab === "users" && <UsersSettings />}
            {tab === "statuses" && <StatusesSettings />}
            {tab === "areas" && <AreasSettings />}
            {tab === "tags" && <TagsSettings />}
          </div>
        </Card>
      </div>
    </div>
  );
}
