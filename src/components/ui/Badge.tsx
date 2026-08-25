import { cn } from "@/lib/utils";

type Tone = "success" | "accent" | "neutral" | "danger" | "info";

const tones: Record<Tone, string> = {
  success: "bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]",
  accent: "bg-yellow-100 text-blue-900",
  neutral: "bg-gray-100 text-gray-700",
  danger: "bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]",
  info: "bg-blue-100 text-blue-800",
};

export function Badge({
  tone = "accent",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
