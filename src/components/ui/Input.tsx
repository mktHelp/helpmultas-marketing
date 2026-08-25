import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-[14px] border border-gray-200 bg-white px-3.5 text-sm text-blue-900 placeholder:text-gray-500",
        "focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-shadow",
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
        "w-full rounded-[14px] border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-blue-900 placeholder:text-gray-500",
        "focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-shadow resize-none",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export function Label({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("mb-1.5 block text-[13px] font-bold text-gray-700", className)} {...props}>
      {children}
    </label>
  );
}
