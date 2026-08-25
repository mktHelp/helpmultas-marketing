"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Sun, ListTodo, ListChecks, Kanban, Calendar,
  FolderKanban, Megaphone, FileText, Users, BarChart3, Settings, Trash2,
  LogOut, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { UserAvatar } from "@/components/shared/UserAvatar";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/my-day", label: "Meu Dia", icon: Sun },
  { href: "/my-tasks", label: "Minhas Tarefas", icon: ListChecks },
  { href: "/tasks", label: "Todas as Tarefas", icon: ListTodo },
  { href: "/board", label: "Quadro", icon: Kanban },
  { href: "/calendar", label: "Calendário", icon: Calendar },
  { href: "/projects", label: "Projetos", icon: FolderKanban },
  { href: "/campaigns", label: "Campanhas", icon: Megaphone },
  { href: "/content", label: "Conteúdos", icon: FileText },
  { href: "/team", label: "Equipe", icon: Users },
  { href: "/reports", label: "Relatórios", icon: BarChart3 },
  { href: "/trash", label: "Lixeira", icon: Trash2 },
  { href: "/settings", label: "Configurações", icon: Settings },
];

const ROLE_LABEL: Record<string, string> = { master: "Master", gestor: "Gestor", membro: "Membro" };

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuth();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-full w-64 flex-col bg-blue-900">
      <div className="flex items-center justify-between px-5 py-6">
        <Image src="/logos/wordmark-white.png" alt="Help Multas" width={130} height={32} />
        {onNavigate && (
          <button onClick={onNavigate} className="rounded-full p-1 text-white/70 hover:bg-white/10 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors",
                active ? "bg-yellow-500 text-blue-900" : "text-blue-100 hover:bg-white/10"
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <UserAvatar name={profile?.full_name || "?"} avatarUrl={profile?.avatar_url} />
          <div className="min-w-0 flex-1">
            <Link href="/profile" className="block truncate text-sm font-semibold text-white hover:underline">
              {profile?.full_name || "Carregando..."}
            </Link>
            <p className="text-xs text-blue-200">{profile ? ROLE_LABEL[profile.role] : ""}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sair"
            className="rounded-full p-2 text-blue-200 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
