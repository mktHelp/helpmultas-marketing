import {
  LayoutDashboard, Sun, ListTodo, ListChecks, FolderKanban, Megaphone, FileText, Users, BarChart3,
  Settings, Trash2, Cake, AtSign, Image as ImageIcon, Mic, HandCoins, TrendingUp, Gauge, Contact, CalendarCheck,
  Lightbulb, Send, Sparkles, ShieldCheck,
  type LucideIcon,
} from "lucide-react";

// Mapa único da navegação do Hub: a sidebar, o "Seção › Página" do topo e o ícone
// padrão de cada cabeçalho saem daqui. Para criar uma aba nova, adicione-a na seção certa.

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** só marca como ativo quando o caminho é exatamente este */
  exact?: boolean;
  /** rótulo no seletor de abas liberadas (Configurações › Usuários), quando difere do menu */
  accessLabel?: string;
  /** fora do catálogo de abas por usuário: herda a regra do caminho-pai ou fica sempre liberada */
  open?: boolean;
}

export interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "overview",
    title: "Visão geral",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/my-day", label: "Meu Dia", icon: Sun },
    ],
  },
  {
    id: "tasks",
    title: "Tarefas",
    items: [
      { href: "/my-tasks", label: "Minhas Tarefas", icon: ListChecks },
      { href: "/tasks", label: "Tarefas", icon: ListTodo, accessLabel: "Tarefas (Quadro, Lista e Calendário)" },
    ],
  },
  {
    id: "planning",
    title: "Planejamento",
    items: [
      { href: "/projects", label: "Projetos", icon: FolderKanban },
      { href: "/campaigns", label: "Campanhas", icon: Megaphone },
      { href: "/content", label: "Conteúdos", icon: FileText },
      { href: "/pautas", label: "Pautas do Dia", icon: Lightbulb },
    ],
  },
  {
    id: "production",
    title: "Produção",
    items: [
      { href: "/teleprompter", label: "Teleprompter", icon: Mic },
      { href: "/creatives", label: "Criativos", icon: ImageIcon },
      { href: "/distribuicao", label: "Distribuição", icon: Send },
    ],
  },
  {
    id: "traffic",
    title: "Tráfego Pago",
    items: [
      { href: "/trafego-pago/dashboard", label: "Painel de tráfego", icon: Gauge, exact: true, accessLabel: "Dashboard de Tráfego" },
      { href: "/trafego-pago", label: "Campanhas Meta", icon: TrendingUp, exact: true, accessLabel: "Tráfego Pago" },
      { href: "/trafego-pago/leads", label: "Leads", icon: Contact, exact: true },
      { href: "/trafego-pago/leads/validacao", label: "Validação de leads", icon: ShieldCheck, exact: true, open: true },
      { href: "/trafego-pago/reunioes", label: "Reuniões", icon: CalendarCheck, exact: true },
    ],
  },
  {
    id: "social",
    title: "Redes sociais",
    items: [{ href: "/instagram", label: "Instagram", icon: AtSign }],
  },
  {
    id: "insights",
    title: "Análises",
    items: [{ href: "/reports", label: "Relatórios", icon: BarChart3 }],
  },
  {
    id: "people",
    title: "Pessoas",
    items: [
      { href: "/team", label: "Equipe", icon: Users },
      { href: "/birthdays", label: "Aniversários", icon: Cake },
    ],
  },
  {
    id: "areas",
    title: "Áreas",
    items: [{ href: "/expansao", label: "Expansão", icon: HandCoins, open: true }],
  },
  {
    id: "system",
    title: "Sistema",
    items: [
      { href: "/settings", label: "Configurações", icon: Settings, open: true },
      { href: "/atualizacoes", label: "Atualizações", icon: Sparkles, open: true },
      { href: "/trash", label: "Lixeira", icon: Trash2 },
    ],
  },
];

export function isNavActive(pathname: string, item: Pick<NavItem, "href" | "exact">) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

/** Seção e item do menu que correspondem ao caminho (prefixo mais específico vence). */
export function locateNav(pathname: string): { section: NavSection; item: NavItem } | null {
  let best: { section: NavSection; item: NavItem } | null = null;
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      const hit = pathname === item.href || pathname.startsWith(item.href + "/");
      if (hit && (!best || item.href.length > best.item.href.length)) best = { section, item };
    }
  }
  return best;
}
