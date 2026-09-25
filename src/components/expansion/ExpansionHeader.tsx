"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { UserAvatar } from "@/components/shared/UserAvatar";

export function ExpansionHeader({ userName, canReturnToHub }: { userName: string; canReturnToHub: boolean }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login?redirectTo=/expansao");
    router.refresh();
  }

  return (
    <header
      className="bg-blue-900"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-4 lg:px-8">
        <div className="flex items-center gap-4">
          <Image src="/logos/wordmark-white.png" alt="Help Multas" width={120} height={30} />
          <span className="hidden border-l border-white/20 pl-4 text-sm font-semibold text-blue-100 sm:block">
            Expansão
          </span>
        </div>
        <div className="flex items-center gap-3">
          {canReturnToHub && (
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-blue-100 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar ao Hub</span>
          </Link>
          )}
          {userName && (
            <>
              <UserAvatar name={userName} />
              <span className="hidden text-sm font-semibold text-white sm:block">{userName}</span>
            </>
          )}
          <button
            onClick={handleLogout}
            title="Sair"
            className="rounded-full p-2 text-blue-200 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
