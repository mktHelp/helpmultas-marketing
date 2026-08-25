"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function Tooltip({
  label,
  children,
  side = "top",
}: {
  label: string;
  children: React.ReactNode;
  side?: "top" | "bottom";
}) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          className={cn(
            "pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-blue-900 px-2.5 py-1 text-xs font-semibold text-white shadow-md",
            side === "top" ? "bottom-full mb-2" : "top-full mt-2"
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
