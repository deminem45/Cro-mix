import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 18 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave",
  "audio/flac", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/ogg",
  "audio/webm", "application/octet-stream"
]);

type TimestampChunk = { text: string; timestamp: [number | null, number | null] };

function parseChunks(value: unknown): TimestampChunk[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): TimestampChunk[] => {
    if (!item || typeof item !== "object") return [];
    const chunk = item as { text?: unknown; timestamp?: unknown; start?: unknown; end?: unknown };
    if (typeof chunk.text !== "string") return [];
    if (Array.isArray(chunk.timestamp)) {
      const [start, end] = chunk.timestamp;
      if ((start === null || typeof start === "number") && (end === null || typeof end === "number")) {
        return [{ text: chunk.text, timestamp: [start, end] }];
      }
    }
    if (typeof chunk.start === "number" && typeof chunk.end === "number") {
      return [{ text: chunk.text, timestamp: [chunk.start, chunk.end] }];
    }
    return [];
  });
}

function errorMessage(result: unknown, fallback: string): string {
  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    if (typeof record.error === "string") return record.error;
    if (record.error && typeof record.error === "object" && "message" in record.error) {
      return String((record.error as { message: unknown }).message);
    }
    if (typeof record.message === "string") return record.message;
  }
  return fallback;
}

async function transcribeWithOpenAI(audio: File, apiKey: string) {
  const form = new FormData();
  form.append("file", audio, audio.name || "audio.mp3");
  form.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  // Whisper accepts ISO-639-1 language codes. Do not force a language unless explicitly configured.
  const language = process.env.TRANSCRIPTION_LANGUAGE;
  if (language && /^[a-z]{2}$/.test(language)) form.append("language", language);
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(90000),
    cache: "no-store"
  });
  const raw = await response.text();
  let result: unknown;
  try { result = JSON.parse(raw); } catch { result = { message: raw.slice(0, 1000) }; }
  if (!response.ok) {
    throw Object.assign(new Error(errorMessage(result, "OpenAI transcription request failed.")), {
      status: response.status,
      retryable: response.status === 429 || response.status >= 500
    });
  }
  const record = result && typeof result === "object" ? result as Record<string, unknown> : {};
  const chunks = parseChunks(record.segments);
  return {
    text: typeof record.text === "string" ? record.text.trim() : "",
    chunks,
    timestampType: chunks.length ? "segment" : "unavailable",
    provider: "openai",
    model: process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1"
  };
}


async function transcribeLocally(audio: File) {
  const baseUrl = (process.env.LOCAL_ASR_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
  const form = new FormData();
  form.append("audio", audio, audio.name || "audio.mp3");
  const response = await fetch(`${baseUrl}/transcribe`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(Number(process.env.LOCAL_ASR_TIMEOUT_MS || 600000)),
    cache: "no-store"
  });
  const raw = await response.text();
  let result: unknown;
  try { result = JSON.parse(raw); } catch { result = { message: raw.slice(0, 1000) }; }
  if (!response.ok) {
    throw Object.assign(new Error(errorMessage(result, "Local ASR service failed.")), {
      status: response.status,
      retryable: response.status >= 500
    });
  }
  const record = result && typeof result === "object" ? result as Record<string, unknown> : {};
  const chunks = parseChunks(record.chunks);
  return {
    text: typeof record.text === "string" ? record.text.trim() : "",
    chunks,
    timestampType: chunks.length ? "segment" : "unavailable",
    provider: "local-whisper",
    model: typeof record.model === "string" ? record.model : "small",
    language: typeof record.language === "string" ? record.language : undefined
  };
}

async function transcribeWithHuggingFace(audio: File, token: string) {
  // HF Inference Providers accepts base64 audio for ASR with return_timestamps.
  const audioBase64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
  const response = await fetch("https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: audioBase64, parameters: { return_timestamps: true } }),
    signal: AbortSignal.timeout(90000),
    cache: "no-store"
  });
  const raw = await response.text();
  let result: unknown;
  try { result = JSON.parse(raw); } catch { result = { message: raw.slice(0, 1000) }; }
  if (!response.ok) {
    throw Object.assign(new Error(errorMessage(result, "Hugging Face inference request failed.")), {
      status: response.status,
      retryable: response.status === 429 || response.status === 503 || response.status >= 500
    });
  }
  const first = Array.isArray(result) ? result[0] : result;
  const record = first && typeof first === "object" ? first as Record<string, unknown> : {};
  const chunks = parseChunks(record.chunks);
  return {
    text: typeof record.text === "string" ? record.text.trim() : "",
    chunks,
    timestampType: chunks.length ? "segment" : "unavailable",
    provider: "huggingface",
    model: "openai/whisper-large-v3"
  };
}

export async function POST(request: Request) {
  const provider = (process.env.TRANSCRIPTION_PROVIDER || (process.env.LOCAL_ASR_URL ? "local" : process.env.OPENAI_API_KEY ? "openai" : process.env.HUGGINGFACE_TOKEN ? "huggingface" : "")).toLowerCase();
  if (!["local", "openai", "huggingface"].includes(provider)) {
    return NextResponse.json({
      error: "Transkripcija nije konfigurirana. Za lokalni način postavi TRANSCRIPTION_PROVIDER=local i pokreni services/local-asr; ili konfiguriraj OpenAI API."
    }, { status: 503 });
  }
  if (provider === "local" && !process.env.LOCAL_ASR_URL && process.env.VERCEL) {\n    return NextResponse.json({ error: "Lokalni ASR nije dostupan ovoj Vercel instanci. Pokreni Cro-mix lokalno ili postavi LOCAL_ASR_URL na privatni, sigurno dostupan ASR worker." }, { status: 503 });\n  }\n  if (provider === "openai" && !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Nedostaje OPENAI_API_KEY za odabranog pružatelja transkripcije." }, { status: 503 });
  }
  if (provider === "huggingface" && !process.env.HUGGINGFACE_TOKEN) {
    return NextResponse.json({ error: "Nedostaje HUGGINGFACE_TOKEN za odabranog pružatelja transkripcije." }, { status: 503 });
  }

  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: "Neispravan multipart zahtjev." }, { status: 400 }); }
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
    const result = provider === "openai"
      ? await transcribeWithOpenAI(audio, process.env.OPENAI_API_KEY!)
      : await transcribeWithHuggingFace(audio, process.env.HUGGINGFACE_TOKEN!);
    if (!result.text) {
      return NextResponse.json({ error: "Servis nije vratio tekst. Pokušaj kraći audio zapis ili drugi format." }, { status: 502 });
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const err = error as Error & { status?: number; retryable?: boolean };
    const timeout = err.name === "TimeoutError" || err.name === "AbortError";
    const status = err.status === 429 ? 429 : timeout ? 504 : err.status && err.status >= 400 && err.status < 500 ? 502 : 502;
    return NextResponse.json({
      error: timeout ? "Transkripcija je istekla. Pokušaj kraći audio isječak." : err.message || "Servis za transkripciju trenutačno nije dostupan.",
      provider,
      retryable: Boolean(err.retryable) || timeout
    }, { status });
  }
}
