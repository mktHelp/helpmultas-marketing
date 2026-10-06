"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { firstAllowedPath, pathAllowed } from "@/lib/access";

/** Se o usuário abrir (por link ou digitando) uma aba que não foi liberada, leva para a primeira liberada. */
export function AccessGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const allowed = pathAllowed(profile, pathname);

  useEffect(() => {
    if (!allowed) router.replace(firstAllowedPath(profile));
  }, [allowed, profile, router]);

  return allowed ? <>{children}</> : null;
}
