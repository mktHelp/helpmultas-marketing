// Controle de abas por usuário (profiles.allowed_tabs). Chaves: caminhos do app
// ("/tasks") e abas da Expansão ("exp:dre"). NULL = acesso padrão do papel.
// Observação: isto controla menu e navegação; os dados continuam protegidos pelo RLS por papel.

export interface TabDef {
  key: string;
  label: string;
}
export interface TabGroup {
  title: string;
  tabs: TabDef[];
}

export const APP_TAB_GROUPS: TabGroup[] = [
  {
    title: "Trabalho",
    tabs: [
      { key: "/dashboard", label: "Dashboard" },
      { key: "/my-day", label: "Meu Dia" },
      { key: "/my-tasks", label: "Minhas Tarefas" },
      { key: "/tasks", label: "Todas as Tarefas" },
      { key: "/board", label: "Quadro" },
      { key: "/calendar", label: "Calendário" },
    ],
  },
  {
    title: "Planejamento",
    tabs: [
      { key: "/projects", label: "Projetos" },
      { key: "/campaigns", label: "Campanhas" },
      { key: "/content", label: "Conteúdos" },
    ],
  },
  {
    title: "Gestão",
    tabs: [
      { key: "/team", label: "Equipe" },
      { key: "/birthdays", label: "Aniversários" },
      { key: "/reports", label: "Relatórios" },
    ],
  },
  {
    title: "Tráfego Pago",
    tabs: [
      { key: "/trafego-pago/dashboard", label: "Dashboard de Tráfego" },
      { key: "/creatives", label: "Criativos" },
      { key: "/trafego-pago", label: "Tráfego Pago" },
      { key: "/trafego-pago/leads", label: "Leads" },
    ],
  },
  {
    title: "Outras áreas",
    tabs: [
      { key: "/instagram", label: "Instagram" },
      { key: "/teleprompter", label: "Teleprompter" },
      { key: "/trash", label: "Lixeira" },
    ],
  },
];

export const EXPANSION_TAB_GROUP: TabGroup = {
  title: "Área da Expansão",
  tabs: [
    { key: "exp:dashboard", label: "Dashboard" },
    { key: "exp:creatives", label: "Criativos" },
    { key: "exp:traffic", label: "Tráfego Pago" },
    { key: "exp:leads", label: "Leads" },
    { key: "exp:dre", label: "DRE" },
  ],
};

/** Grupos que aparecem no seletor, conforme o papel de quem está sendo cadastrado. */
export function tabGroupsForRole(role: string): TabGroup[] {
  if (role === "master") return [];
  if (role === "expansao") return [EXPANSION_TAB_GROUP];
  return [...APP_TAB_GROUPS, EXPANSION_TAB_GROUP];
}

export const allTabKeys = (groups: TabGroup[]) => groups.flatMap((g) => g.tabs.map((t) => t.key));

type Who = { role: string; allowed_tabs?: string[] | null } | null | undefined;

export function hasTab(profile: Who, key: string): boolean {
  if (!profile || profile.role === "master" || !profile.allowed_tabs) return true;
  return profile.allowed_tabs.includes(key);
}

export const hasAnyExpansionTab = (profile: Who) => EXPANSION_TAB_GROUP.tabs.some((t) => hasTab(profile, t.key));

const APP_KEYS_BY_LENGTH = allTabKeys(APP_TAB_GROUPS).sort((a, b) => b.length - a.length);

/** O caminho atual é permitido? Rotas fora do catálogo (perfil, assistente, configurações…) sempre são. */
export function pathAllowed(profile: Who, pathname: string): boolean {
  if (pathname === "/expansao" || pathname.startsWith("/expansao/")) {
    // o chat do Helpinho dentro da Expansão fica sempre liberado
    if (pathname.startsWith("/expansao/assistente")) return true;
    return hasAnyExpansionTab(profile);
  }
  const key = APP_KEYS_BY_LENGTH.find((k) => pathname === k || pathname.startsWith(k + "/"));
  return key ? hasTab(profile, key) : true;
}

/** Primeira rota do app que o usuário pode abrir (destino do redirecionamento). */
export function firstAllowedPath(profile: Who): string {
  const key = allTabKeys(APP_TAB_GROUPS).find((k) => hasTab(profile, k));
  if (key) return key;
  if (hasAnyExpansionTab(profile)) return "/expansao";
  return "/assistente";
}
