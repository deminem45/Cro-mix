import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 18 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave",
  "audio/flac", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/ogg",
  "audio/webm", "application/octet-stream"
]);

export async function POST(request: Request) {
  const token = process.env.HUGGINGFACE_TOKEN;
  if (!token) {
    return NextResponse.json({
      error: "Transkripcija nije konfigurirana. Dodaj HUGGINGFACE_TOKEN u Vercel Environment Variables."
    }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Neispravan multipart zahtjev." }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Nedostaje audio datoteka u polju audio." }, { status: 400 });
  }
  if (!audio.size || audio.size > MAX_BYTES) {
    return NextResponse.json({ error: "Datoteka mora imati između 1 bajta i 18 MB." }, { status: 413 });
  }
  if (audio.type && !ALLOWED_TYPES.has(audio.type.toLowerCase())) {
    return NextResponse.json({ error: "Nepodržan audio format. Pokušaj MP3, WAV, FLAC, M4A ili OGG." }, { status: 415 });
  }

  try {
    const response = await fetch("https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": audio.type || "application/octet-stream"
      },
      body: await audio.arrayBuffer(),
      signal: AbortSignal.timeout(25000),
      cache: "no-store"
    });
    const raw = await response.text();
    let result: unknown;
    try { result = JSON.parse(raw); } catch { result = { message: raw.slice(0, 1000) }; }

    if (!response.ok) {
      const detail = typeof result === "object" && result !== null && "error" in result
        ? String((result as {error: unknown}).error)
        : "Hugging Face inference request failed.";
      const status = response.status === 429 ? 429 : response.status === 503 ? 503 : 502;
      return NextResponse.json({ error: detail, provider: "huggingface", retryable: status === 429 || status === 503 }, { status });
    }

    const text = typeof result === "object" && result !== null && "text" in result
      ? String((result as {text: unknown}).text ?? "").trim()
      : Array.isArray(result) && result[0] && typeof result[0] === "object" && "text" in result[0]
        ? String((result[0] as {text: unknown}).text ?? "").trim()
        : "";
    if (!text) {
      return NextResponse.json({ error: "Servis nije vratio tekst. Pokušaj kraći audio zapis ili drugi format." }, { status: 502 });
    }
    return NextResponse.json({ text, provider: "huggingface", model: "openai/whisper-large-v3" }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json({
      error: timeout ? "Transkripcija je istekla zbog vremenskog ograničenja. Pokušaj kraći isječak." : "Servis za transkripciju trenutačno nije dostupan.",
      retryable: true
    }, { status: 504 });
  }
}
