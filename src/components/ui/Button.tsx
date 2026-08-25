"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "dark" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-yellow-500 text-blue-900 hover:bg-yellow-600 active:scale-[0.97] shadow-sm",
  dark: "bg-blue-900 text-white hover:bg-blue-800 active:scale-[0.97] shadow-sm",
  secondary:
    "bg-white text-blue-900 border-2 border-blue-900 hover:bg-blue-050 active:scale-[0.97]",
  ghost: "bg-transparent text-blue-900 hover:bg-blue-050 active:scale-[0.97]",
  danger: "bg-white text-[color:var(--color-danger)] border-2 border-[color:var(--color-danger)] hover:bg-[color:var(--color-danger-bg)] active:scale-[0.97]",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[13px] gap-1.5",
  md: "h-10 px-5 text-sm gap-2",
  lg: "h-12 px-7 text-base gap-2",
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
          "inline-flex items-center justify-center rounded-full font-display font-semibold transition-all duration-150 whitespace-nowrap select-none",
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
