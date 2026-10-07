"use client";

import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { iconForPath } from "./pageIcons";

/**
 * Cabeçalho único de todas as páginas: ícone amarelo, título, descrição e ações à direita.
 * Em telas estreitas as ações descem para a linha de baixo, sem cortar nada.
 * Sem `icon`, usa o ícone da própria página na sidebar.
 * Em páginas de servidor NÃO passe `icon` (componente não atravessa para o cliente): deixe o padrão da rota.
 */
export function PageHeader({
  icon,
  title,
  description,
  action,
  aside,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string | null;
  action?: React.ReactNode;
  /** conteúdo extra à direita do título (ex.: anel de progresso) */
  aside?: React.ReactNode;
  /** linha de pílulas/estatísticas abaixo do título */
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  // iconForPath devolve sempre um componente constante do módulo (tabela em pageIcons.ts)
  const Icon = icon ?? iconForPath(pathname);
  return (
    <header className="ast-fade-up mb-5 sm:mb-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-yellow-500 text-blue-900 shadow-[var(--shadow-sm)] sm:h-12 sm:w-12">
          {/* eslint-disable-next-line react-hooks/static-components */}
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </span>
        <div className="min-w-0 flex-1 basis-52">
          <h1 className="font-display text-xl font-bold leading-tight text-blue-900 sm:text-2xl">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
        </div>
        {aside}
        {action && <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2 max-sm:w-full">{action}</div>}
      </div>
      {children && <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-blue-900">{children}</div>}
    </header>
  );
}
