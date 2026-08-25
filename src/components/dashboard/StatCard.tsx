import { type LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: number;
  tone?: "neutral" | "danger" | "success" | "accent";
}) {
  const toneClasses = {
    neutral: "bg-blue-050 text-blue-900",
    danger: "bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]",
    success: "bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]",
    accent: "bg-yellow-050 text-yellow-600",
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </span>
        {trend !== undefined && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-bold",
              trend >= 0 ? "text-[color:var(--color-success)]" : "text-[color:var(--color-danger)]"
            )}
          >
            {trend >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="mt-4 font-display text-3xl font-bold text-blue-900">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </Card>
  );
}
