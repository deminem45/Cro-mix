import { NextResponse } from "next/server";
import { providerReadiness } from "@/lib/providers";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({
    app:"Cro-mix Studio",
    generationEnabled:false,
    note:"Catalog availability is not the same as a completed provider integration. Generation stays disabled until adapter, secure upload, job polling and output storage are tested.",
    providers:providerReadiness()
  }, {headers:{"Cache-Control":"no-store"}});
}
