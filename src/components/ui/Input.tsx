import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-[10px] border border-gray-200 bg-white px-3 text-[13px] text-blue-900 placeholder:text-gray-500",
        "focus:outline-none focus:border-yellow-500 focus:shadow-[var(--shadow-focus)] transition-shadow",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-[13px] text-blue-900 placeholder:text-gray-500",
        "focus:outline-none focus:border-yellow-500 focus:shadow-[var(--shadow-focus)] transition-shadow resize-none",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export function Label({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("mb-1.5 block text-xs font-bold text-gray-700", className)} {...props}>
      {children}
    </label>
  );
}
