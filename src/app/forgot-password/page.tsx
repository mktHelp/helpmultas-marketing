import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requestPasswordReset } from "./actions";
import { Input, Label } from "@/components/ui/Input";
import { SubmitButton } from "@/components/shared/SubmitButton";
import { getCurrentUserAndProfile } from "@/lib/supabase/get-current-user";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;

  const { user } = await getCurrentUserAndProfile();
  if (user) redirect("/dashboard");

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

          <h2 className="font-display text-2xl font-bold text-blue-900">Esqueci a senha</h2>
          <p className="mt-1 text-sm text-gray-500">
            Informe seu e-mail e enviaremos um link para redefinir sua senha.
          </p>

          {params.error && (
            <div className="mt-4 rounded-[14px] bg-[color:var(--color-danger-bg)] px-4 py-3 text-sm text-[color:var(--color-danger)]">
              {params.error}
            </div>
          )}

          {params.sent ? (
            <div className="mt-6 rounded-[14px] bg-blue-050 px-4 py-3 text-sm text-blue-900">
              Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha em
              instantes. Confira também a caixa de spam.
            </div>
          ) : (
            <form action={requestPasswordReset} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" placeholder="voce@helpmultas.com" required />
              </div>
              <SubmitButton size="lg" className="w-full gap-2" pendingLabel="Enviando...">
                Enviar link de redefinição
              </SubmitButton>
            </form>
          )}

          <p className="mt-8 text-center text-sm text-gray-500">
            <Link href="/login" className="font-semibold text-blue-900 hover:underline">
              Voltar para o login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
