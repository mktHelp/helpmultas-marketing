import Image from "next/image";
import { redirect } from "next/navigation";
import { updatePassword } from "./actions";
import { Input, Label } from "@/components/ui/Input";
import { SubmitButton } from "@/components/shared/SubmitButton";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  const { user } = await getCurrentUserAndProfile();
  if (!user) redirect("/login?error=Sua%20sess%C3%A3o%20expirou%2C%20solicite%20um%20novo%20link");

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-blue-900 p-12 lg:flex">
        <Image src="/logos/wordmark-white.png" alt="Help Multas" width={160} height={40} />
        <div>
          <h1 className="font-display text-4xl font-bold leading-tight text-white">
            Organize. Produza. Entregue.
          </h1>
          <p className="mt-4 max-w-md text-base text-blue-100">
            Centralize toda a operação do Marketing Help Multas em um só lugar.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Image src="/logos/lockup-yellow.png" alt="Helpinho" width={48} height={48} />
          <p className="text-sm text-blue-100">
            A maior rede de franquias de recursos de multas do Brasil.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-4 lg:hidden">
            <Image src="/logos/lockup-yellow.png" alt="Help Multas" width={64} height={64} />
          </div>

          <h2 className="font-display text-2xl font-bold text-blue-900">Defina uma nova senha</h2>
          <p className="mt-1 text-sm text-gray-500">Escolha uma nova senha para acessar o painel.</p>

          {params.error && (
            <div className="mt-4 rounded-[14px] bg-[color:var(--color-danger-bg)] px-4 py-3 text-sm text-[color:var(--color-danger)]">
              {params.error}
            </div>
          )}

          <form action={updatePassword} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                minLength={8}
                required
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirme a nova senha</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                minLength={8}
                required
              />
            </div>
            <SubmitButton size="lg" className="w-full gap-2" pendingLabel="Salvando...">
              Salvar nova senha
            </SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
