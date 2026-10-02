import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  blue: "from-blue-900 via-blue-800 to-blue-700",
  traffic: "from-blue-900 via-sky-800 to-indigo-700",
  day: "from-blue-900 via-blue-800 to-[#2c5a73]",
} as const;

/** Faixa de abertura das páginas: ícone, título, descrição, ação e até uma linha de pílulas. */
export function PageHero({
  icon: Icon,
  title,
  description,
  action,
  tone = "blue",
  children,
  aside,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: keyof typeof TONES;
  /** linha de pílulas/estatísticas abaixo do título */
  children?: React.ReactNode;
  /** conteúdo à direita (ex.: anel de progresso) */
  aside?: React.ReactNode;
}) {
  return (
    <div className={cn("ast-fade-up relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-br p-4 text-white sm:p-6", TONES[tone])}>
      <div className="pointer-events-none absolute -right-10 -top-12 h-52 w-52 rounded-full bg-yellow-500/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-sky-400/10 blur-3xl" aria-hidden />
      <div className="relative flex flex-wrap items-center gap-3 sm:gap-4">
        <span className="ast-float flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-yellow-500 text-blue-900 shadow-lg sm:h-14 sm:w-14">
          <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
        </span>
        <div className="min-w-0 flex-1 basis-56">
          <h1 className="font-display text-xl font-bold sm:text-2xl">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-blue-100">{description}</p>}
        </div>
        {aside}
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
      {children && <div className="relative mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold sm:mt-4 sm:gap-2 sm:text-xs">{children}</div>}
    </div>
  );
}
