import { NextResponse } from "next/server";
import { providerReadiness } from "@/lib/providers";

export const dynamic = "force-dynamic";

export async function GET() {
  const providers = providerReadiness();
  const configuredProviderCount = providers.filter((provider) => provider.configured).length;
  return NextResponse.json({
    ok: true,
    app: "Cro-mix Studio",
    mode: configuredProviderCount > 0 ? "provider-credentials-configured" : "free-first-catalog",
    configuredProviderCount,
    generationReady: false,
    note: "Credentials alone do not enable generation. Provider adapters, secure uploads, asynchronous jobs and verified output storage must be implemented and tested."
  }, { headers: { "Cache-Control": "no-store" } });
}
