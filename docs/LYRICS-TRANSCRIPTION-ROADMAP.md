# Cro-mix Lyrics Transcription & Refinement

## Goal

Build a conservative, multilingual song-lyrics workflow for Croatian (hr), Serbian (sr; Latin and Cyrillic source text), and Bosnian (bs). Speech-recognition benchmarks must not be presented as proof of singing accuracy.

## Current implementation

- `POST /api/transcribe`: Hugging Face Whisper large-v3 inference, gated by server-side `HUGGINGFACE_TOKEN`. Returns plain transcript text only; it does not yet provide word timestamps or verified confidence.
- `POST /api/lyrics/refine`: OpenAI-compatible chat completions adapter. It accepts lyrics and a language/mode, returns structured JSON with proposed changes and warnings. It does not hear the source audio and must never be treated as verification of what was sung.
- `format_only` is the safe default; it must preserve lexical words. `review` allows conservative spelling/diacritic suggestions and returns a change list.

## Environment

Set only in server-side deployment environment variables:

- `LYRICS_LLM_BASE_URL`: OpenAI-compatible API base URL, normally ending in `/v1` (the route appends `/chat/completions`).
- `LYRICS_LLM_MODEL`: exact model identifier supported by that endpoint.
- `LYRICS_LLM_API_KEY`: optional only for trusted local/self-hosted endpoints; required by most hosted APIs.

A compatible local service can be used for development if the Next.js server can reach it. A local URL such as `127.0.0.1` inside a cloud deployment refers to that deployment's own container, not the developer's PC. Hosted free quotas change and are not guaranteed; the adapter itself does not imply that any provider is free.

## Next implementation phases

1. Build a song-focused benchmark by language and acoustic conditions. Use manually verified reference lyrics with permission to use them.
2. Compare `whisper-large-v3`, `turbo`, and small/medium variants plus at least one independent hosted ASR. Store raw transcripts before normalization.
3. Report WER and CER, both raw and with a documented normalization profile. Do not silently erase diacritics or script differences in the raw score.
4. Test original mix vs vocal stem. Stem separation can introduce artifacts; keep both transcripts and compare rather than assuming the stem is always better.
5. Add forced alignment as a separate stage. Only expose word timestamps when a language-appropriate aligner succeeds; otherwise mark timing as approximate/unavailable.
6. Implement an editor with per-word confidence/uncertainty, A/B audio playback, accepted/rejected edits, and re-alignment after text changes.
7. Export TXT, SRT, VTT, LRC and structured JSON. Keep source transcript, refined transcript, accepted changes and timing provenance separately.

## Proposed result schema

```json
{
  "language": "hr",
  "text": "Noćas sam te tražio",
  "segments": [{
    "start": 0.42,
    "end": 2.18,
    "text": "Noćas sam te tražio",
    "words": [{
      "text": "Noćas",
      "start": 0.42,
      "end": 0.91,
      "confidence": null,
      "timingStatus": "aligned"
    }]
  }]
}
```

The values above are illustrative only. Use `null` when a provider does not return a calibrated confidence score. Do not invent word-level timestamps by dividing sentence duration evenly.

## Benchmark methodology

For each language and singing condition, maintain:
- source audio provenance and permission;
- human-verified ground-truth transcript;
- word-level reference timestamps for alignment tests;
- raw provider output and model/version/date;
- WER, CER, timestamp boundary error, latency, and actual cost;
- scores before and after refinement.

Start with 30–50 diverse clips as an engineering smoke-test set, then expand before making any broad accuracy claim. Include male/female vocals, duet, dense accompaniment, reverberation, melisma, repeated chorus, dialect, code-switching and both Serbian scripts.

## Safety and privacy

- Never expose provider keys to the browser.
- Avoid logging uploaded audio or full lyrics unnecessarily.
- Validate size/type, rate-limit expensive routes, and use asynchronous jobs for long audio.
- Respect copyright and only process audio the user owns or is authorized to use.
