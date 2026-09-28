import Image from "next/image";
import { confirmRecovery } from "./actions";
import { SubmitButton } from "@/components/shared/SubmitButton";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; next?: string }>;
}) {
  const params = await searchParams;

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

          <h2 className="font-display text-2xl font-bold text-blue-900">Confirmar redefinição</h2>
          <p className="mt-1 text-sm text-gray-500">
            Clique no botão abaixo para confirmar e continuar redefinindo sua senha.
          </p>

          <form action={confirmRecovery} className="mt-6 space-y-4">
            <input type="hidden" name="code" value={params.code || ""} />
            <input type="hidden" name="next" value={params.next || "/dashboard"} />
            <SubmitButton size="lg" className="w-full gap-2" pendingLabel="Confirmando...">
              Confirmar e continuar
            </SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
