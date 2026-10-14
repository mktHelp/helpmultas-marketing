import type { NextConfig } from "next";

// Identifica o deploy: o navegador compara o valor embutido no seu bundle com o que
// /api/version responde (servidor atual) para avisar que há uma versão nova.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now());

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
};

export default nextConfig;
