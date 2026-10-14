import { CHANGELOG } from "@/lib/changelog";

// Sempre responde a versão do deploy que está no ar (nunca em cache).
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "", entries: CHANGELOG.slice(0, 15) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
