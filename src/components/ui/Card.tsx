import { cn } from "@/lib/utils";

/**
 * Card padrão (v3). Com `notch`, ganha um encaixe com bordas invertidas no canto
 * superior direito para um ícone/ação — nesse caso o card fica sem borda, e o
 * recorte é pintado com a cor de quem está por fora (ver .hm-card no globals.css:
 * cards aninhados alternam branco/cinza automaticamente).
 */
export function Card({
  className,
  children,
  notch,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { notch?: React.ReactNode }) {
  return (
    <div
      className={cn(
        "hm-card relative rounded-2xl print:break-inside-avoid",
        notch ? "shadow-[var(--shadow-sm)]" : "border border-gray-200/80",
        className
      )}
      {...props}
    >
      {notch && <div className="ic-slot">{notch}</div>}
      {children}
    </div>
  );
}

/** Ícone/ação redondo para o encaixe (`notch`) do Card. */
export function NotchIcon({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={cn("flex h-9 w-9 items-center justify-center rounded-[11px] bg-blue-900 text-yellow-500", className)} style={style}>
      {children}
    </span>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-start justify-between gap-3 p-5 pb-0", className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("font-display text-[15px] font-semibold text-blue-900", className)} {...props}>
      {children}
    </h3>
  );
}
