import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT_CHARS = 20_000;
const LANGUAGES = new Set(["auto", "hr", "sr", "bs"]);
const MODES = new Set(["format_only", "review"]);

type RefineResult = {
  refinedText: string;
  changes: Array<{ original: string; replacement: string; reason: string }>;
  warnings: string[];
};

function parseResult(value: unknown): RefineResult | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.refinedText !== "string" || !Array.isArray(obj.changes) || !Array.isArray(obj.warnings)) return null;
  const changes = obj.changes.filter((item): item is {original:string;replacement:string;reason:string} => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    return typeof row.original === "string" && typeof row.replacement === "string" && typeof row.reason === "string";
  }).slice(0, 100);
  return {
    refinedText: obj.refinedText.slice(0, MAX_TEXT_CHARS),
    changes,
    warnings: obj.warnings.filter((item): item is string => typeof item === "string").slice(0, 30)
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Neispravan JSON zahtjev." }, { status: 400 }); }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Nedostaje tekst za doradu." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const text = typeof input.text === "string" ? input.text.trim() : "";
  const language = typeof input.language === "string" && LANGUAGES.has(input.language) ? input.language : "auto";
  const mode = typeof input.mode === "string" && MODES.has(input.mode) ? input.mode : "format_only";
  if (!text) return NextResponse.json({ error: "Unesi lyrics prije AI dorade." }, { status: 400 });
  if (text.length > MAX_TEXT_CHARS) return NextResponse.json({ error: "Tekst je predug. Maksimum je 20.000 znakova." }, { status: 413 });

  const baseUrl = process.env.LYRICS_LLM_BASE_URL?.trim();
  const apiKey = process.env.LYRICS_LLM_API_KEY?.trim();
  const model = process.env.LYRICS_LLM_MODEL?.trim();
  if (!baseUrl || !model) {
    return NextResponse.json({
      error: "AI Lyrics Refine nije konfiguriran. Postavi LYRICS_LLM_BASE_URL i LYRICS_LLM_MODEL; API ključ je opcionalan za lokalni servis."
    }, { status: 503 });
  }

  const languageName = language === "hr" ? "Croatian" : language === "sr" ? "Serbian" : language === "bs" ? "Bosnian" : "the language used in the supplied lyrics";
  const modeInstruction = mode === "format_only"
    ? "FORMAT-ONLY MODE: preserve every lexical word exactly. Do not replace, add, remove, translate, paraphrase, or infer words. You may only normalize whitespace, line breaks, section labels, capitalization and punctuation. If a token looks wrong, leave it unchanged and add a warning."
    : "REVIEW MODE: suggest only high-confidence spelling or diacritic corrections for Croatian, Serbian, or Bosnian. Lyrics are colloquial and may contain dialect, slang, archaic forms, names, and intentional grammar. Never rewrite for literary quality. If uncertain, preserve the original and add a warning.";
  const system = `You are a conservative lyrics transcript editor, not a songwriter. Language: ${languageName}. ${modeInstruction}
Never invent words or claim you heard audio; you receive text only. Keep section labels such as [Verse 1], [Chorus], [Bridge] and repeated lines. Return valid JSON only, with exactly this shape: {"refinedText":"string","changes":[{"original":"string","replacement":"string","reason":"string"}],"warnings":["string"]}. Every change must be traceable to the input. If no safe change is justified, return the input unchanged, changes: [], warnings: [].`;

  try {
    const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify({ lyrics: text }) }
        ]
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000)
    });
    const raw = await response.text();
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { payload = null; }
    if (!response.ok) {
      return NextResponse.json({
        error: "LLM servis je odbio zahtjev.",
        retryable: response.status === 429 || response.status >= 500,
        providerStatus: response.status
      }, { status: response.status === 429 ? 429 : 502 });
    }
    const choices = payload && typeof payload === "object" ? (payload as {choices?: unknown}).choices : null;
    const first = Array.isArray(choices) ? choices[0] : null;
    const message = first && typeof first === "object" ? (first as {message?: {content?: unknown}}).message : null;
    const content = typeof message?.content === "string" ? message.content : "";
    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch { parsed = null; }
    const result = parseResult(parsed);
    if (!result || !result.refinedText.trim()) {
      return NextResponse.json({ error: "LLM nije vratio očekivanu strukturu lyrics rezultata." }, { status: 502 });
    }
    return NextResponse.json({
      ...result,
      language,
      mode,
      model,
      sourceText: text,
      disclaimer: "Doradu je napravio jezični model bez pristupa izvornom audiju. Provjeri svaku izmjenu; za potvrdu otpjevanih riječi potrebna je audio provjera."
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json({
      error: timeout ? "AI dorada je istekla nakon 30 sekundi." : "AI servis za doradu trenutačno nije dostupan.",
      retryable: true
    }, { status: 504 });
  }
}
