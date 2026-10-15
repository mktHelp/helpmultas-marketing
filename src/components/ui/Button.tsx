"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "dark" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-yellow-500 text-blue-900 hover:bg-yellow-600 active:scale-[0.98]",
  dark: "bg-blue-900 text-white hover:bg-blue-800 active:scale-[0.98]",
  secondary:
    "bg-white text-blue-900 border border-gray-200 hover:border-gray-300 hover:bg-gray-050 active:scale-[0.98]",
  ghost: "bg-transparent text-blue-900 hover:bg-gray-100 active:scale-[0.98]",
  danger: "bg-white text-[color:var(--color-danger)] border border-[color:var(--color-danger)]/40 hover:bg-[color:var(--color-danger-bg)] active:scale-[0.98]",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-4 text-[13px] gap-2",
  lg: "h-11 px-6 text-sm gap-2",
  icon: "h-9 w-9 p-0",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center rounded-[10px] font-bold transition-all duration-150 whitespace-nowrap select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2",
          disabled && "opacity-45 cursor-not-allowed pointer-events-none",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
