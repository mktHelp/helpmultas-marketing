import { Bot, Calculator, HandCoins, UserCircle, type LucideIcon } from "lucide-react";
import { NAV_SECTIONS } from "@/lib/navigation";

// Ícone de cada página (o mesmo da sidebar), usado pelo cabeçalho padrão quando a
// página não informa um. Vale o prefixo mais específico.
const ICONS: [string, LucideIcon][] = [
  ...NAV_SECTIONS.flatMap((s) => s.items.map((i): [string, LucideIcon] => [i.href, i.icon])),
  ["/assistente", Bot],
  ["/profile", UserCircle],
  ["/expansao/assistente", Bot],
  ["/expansao", HandCoins],
];

export function iconForPath(pathname: string): LucideIcon {
  const hit = ICONS.filter(([p]) => pathname === p || pathname.startsWith(p + "/")).sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? hit[1] : Calculator;
}
