import { type LucideIcon, Inbox } from "lucide-react";
import { Button } from "./Button";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-300/70 bg-white/60 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-900">
        <Icon className="h-5 w-5 text-yellow-500" />
      </div>
      <div>
        <p className="font-display text-[15px] font-semibold text-blue-900">{title}</p>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
