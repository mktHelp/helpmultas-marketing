"use client";

import { forwardRef } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Checkbox = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, checked, ...props }, ref) => (
    <label className={cn("relative inline-flex h-5 w-5 cursor-pointer items-center justify-center", className)}>
      <input ref={ref} type="checkbox" checked={checked} className="peer sr-only" {...props} />
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-md border-2 border-gray-300 bg-white transition-colors",
          "peer-checked:border-yellow-500 peer-checked:bg-yellow-500",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-yellow-500 peer-focus-visible:ring-offset-1"
        )}
      >
        {checked && <Check className="h-3.5 w-3.5 text-blue-900" strokeWidth={3} />}
      </span>
    </label>
  )
);
Checkbox.displayName = "Checkbox";

export function Radio({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("relative inline-flex h-5 w-5 cursor-pointer items-center justify-center", className)}>
      <input type="radio" className="peer sr-only" {...props} />
      <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-300 peer-checked:border-yellow-500 transition-colors">
        <span className="h-2.5 w-2.5 scale-0 rounded-full bg-yellow-500 transition-transform peer-checked:scale-100" />
      </span>
    </label>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-1",
        checked ? "bg-yellow-500" : "bg-gray-300",
        className
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          checked && "translate-x-5"
        )}
      />
    </button>
  );
}
