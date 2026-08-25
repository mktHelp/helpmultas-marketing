import Image from "next/image";
import { redirect } from "next/navigation";
import { signIn } from "./actions";
import { Input, Label } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { SubmitButton } from "@/components/shared/SubmitButton";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const params = await searchParams;

  const { user } = await getCurrentUserAndProfile();
  if (user) redirect(params.redirectTo || "/dashboard");

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

          <h2 className="font-display text-2xl font-bold text-blue-900">Bem-vindo de volta</h2>
          <p className="mt-1 text-sm text-gray-500">Entre com suas credenciais para acessar o painel.</p>

          {params.error && (
            <div className="mt-4 rounded-[14px] bg-[color:var(--color-danger-bg)] px-4 py-3 text-sm text-[color:var(--color-danger)]">
              {params.error}
            </div>
          )}

          <form action={signIn} className="mt-6 space-y-4">
            <input type="hidden" name="redirectTo" value={params.redirectTo || "/dashboard"} />
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" placeholder="voce@helpmultas.com" required />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" placeholder="••••••••" required />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <Checkbox name="remember" defaultChecked />
                Lembrar acesso
              </label>
              <a href="#" className="text-sm font-semibold text-blue-900 hover:underline">
                Esqueci a senha
              </a>
            </div>
            <SubmitButton size="lg" className="w-full gap-2" pendingLabel="Entrando...">
              Entrar
            </SubmitButton>
          </form>

          <p className="mt-8 text-center text-xs text-gray-500">
            Acesso restrito ao time de Marketing Help Multas.
          </p>
        </div>
      </div>
    </div>
  );
}
