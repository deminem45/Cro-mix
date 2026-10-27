# Cro-mix transcription providers

The transcription API can run without Hugging Face.

## Option A: OpenAI API (hosted)

Configure server-side environment variables:

```env
TRANSCRIPTION_PROVIDER=openai
OPENAI_API_KEY=your_secret_key
OPENAI_TRANSCRIPTION_MODEL=whisper-1
# Optional; omit for automatic language detection
TRANSCRIPTION_LANGUAGE=
```

The route uploads audio to OpenAI's `/v1/audio/transcriptions` endpoint using `whisper-1` and requests verbose JSON with segment timestamps. OpenAI API usage is billed separately from a ChatGPT subscription. Keep the key in Vercel server-side environment variables only; never prefix it with `NEXT_PUBLIC_`.

To use the newer transcription models, check their supported response formats before changing `OPENAI_TRANSCRIPTION_MODEL`. The current export implementation expects segment timestamps, which are requested with `whisper-1`.

## Option B: Hugging Face

Only if desired:

```env
TRANSCRIPTION_PROVIDER=huggingface
HUGGINGFACE_TOKEN=your_token
```

This selects the existing Whisper large-v3 hosted endpoint. The OpenAI route does not require a Hugging Face account or token.

## Option C: completely local/offline

The current Next.js route does not run an ASR model locally. To avoid both Hugging Face and hosted transcription costs, run an ASR service on your own computer/server, such as `whisper.cpp`, and add a dedicated local worker adapter. A local service bound to `127.0.0.1` is not reachable from a deployed Vercel app; for a deployed app, the worker needs a secure, reachable endpoint or the browser must transcribe locally.

Official local inference implementation: https://github.com/ggml-org/whisper.cpp

## Limitations

- Transcription quality on sung vocals can be lower than on speech, especially with loud instrumentation, reverb, backing vocals, and vocal effects.
- Segment timestamps are not word-level alignment.
- No actual audio was sent during implementation; configure a provider and test on licensed audio plus a manually verified reference transcript.
