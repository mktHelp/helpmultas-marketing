import {
  LayoutDashboard, Sun, ListTodo, ListChecks, Kanban, Calendar, FolderKanban, Megaphone, FileText, Users, BarChart3,
  Settings, Trash2, Cake, AtSign, Image as ImageIcon, Bot, Mic, HandCoins, TrendingUp, UserCircle, Gauge, Contact, Calculator,
  type LucideIcon,
} from "lucide-react";

// Ícone de cada página (o mesmo da sidebar), usado pelo cabeçalho padrão quando a
// página não informa um. Vale o prefixo mais específico.
const ICONS: [string, LucideIcon][] = [
  ["/dashboard", LayoutDashboard],
  ["/my-day", Sun],
  ["/my-tasks", ListChecks],
  ["/tasks", ListTodo],
  ["/board", Kanban],
  ["/calendar", Calendar],
  ["/projects", FolderKanban],
  ["/campaigns", Megaphone],
  ["/content", FileText],
  ["/team", Users],
  ["/birthdays", Cake],
  ["/reports", BarChart3],
  ["/instagram", AtSign],
  ["/trafego-pago/dashboard", Gauge],
  ["/trafego-pago/leads", Contact],
  ["/trafego-pago", TrendingUp],
  ["/creatives", ImageIcon],
  ["/teleprompter", Mic],
  ["/trash", Trash2],
  ["/settings", Settings],
  ["/assistente", Bot],
  ["/profile", UserCircle],
  ["/expansao/assistente", Bot],
  ["/expansao", HandCoins],
];

export function iconForPath(pathname: string): LucideIcon {
  const hit = ICONS.filter(([p]) => pathname === p || pathname.startsWith(p + "/")).sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? hit[1] : Calculator;
}
