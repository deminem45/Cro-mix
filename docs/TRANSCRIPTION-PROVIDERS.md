# Cro-mix transcription providers

Cro-mix supports a **local CPU Whisper service** so audio can be transcribed without a Hugging Face account/token or paid transcription API. The model is downloaded once from the official OpenAI Whisper model hosting and then inference runs on your computer. The first run needs an internet connection for installation/model download; after setup, transcription itself can run offline.

## Option A: local CPU Whisper (recommended for private/offline use)

### Windows

1. Install Python 3.10–3.12 and FFmpeg. Make sure `ffmpeg -version` works in PowerShell.
2. Open a terminal in the repository root.
3. Start the service:

```powershell
powershell -ExecutionPolicy Bypass -File .\services\local-asr\run-windows.ps1
```

The script creates a virtual environment, installs dependencies, copies `.env.example` to `.env`, and starts the service at `http://127.0.0.1:8765`. The first transcription downloads the selected model, so keep the terminal open and allow time for that download.

### Linux / macOS

Install Python 3 and FFmpeg, then run:

```bash
bash services/local-asr/run.sh
```

### Connect the Next.js app

In the project-root `.env.local`:

```env
TRANSCRIPTION_PROVIDER=local
LOCAL_ASR_URL=http://127.0.0.1:8765
LOCAL_ASR_TIMEOUT_MS=600000
```

Restart `npm run dev` after changing environment variables. Open `http://127.0.0.1:3000`, upload an audio file, and transcribe. Keep the ASR terminal running while using the app.

### CPU model choices

Edit `services/local-asr/.env` before starting the service:

- `ASR_MODEL=base`: faster, lower accuracy.
- `ASR_MODEL=small`: balanced starting point for Croatian/Serbian/Bosnian.
- `ASR_MODEL=medium`: often worth testing for multilingual lyrics, but much slower and more memory-hungry on CPU.
- `ASR_LANGUAGE=hr`, `sr`, or `bs`: optionally force the language; leave blank for automatic detection.

The service defaults to `small` on CPU. You can compare `small` and `medium` on the same reference songs using the benchmark scripts. Model quality for sung lyrics is not guaranteed: loud instruments, reverb, backing vocals, dialects, and melodic vowel stretching can cause errors. Segment timestamps are not word-level alignment.

The service binds to `127.0.0.1` by default and is intended for local development. Do not bind it to a public interface without adding authentication, request limits, and network controls.

## Option B: OpenAI API (hosted)

Configure server-side environment variables:

```env
TRANSCRIPTION_PROVIDER=openai
OPENAI_API_KEY=your_secret_key
OPENAI_TRANSCRIPTION_MODEL=whisper-1
# Optional; omit for automatic language detection
TRANSCRIPTION_LANGUAGE=
```

The route uploads audio to OpenAI's `/v1/audio/transcriptions` endpoint using `whisper-1` and requests verbose JSON with segment timestamps. OpenAI API usage is billed separately from a ChatGPT subscription. Keep the key in server-side environment variables only; never prefix it with `NEXT_PUBLIC_`.

## Option C: Hugging Face (optional legacy provider)

Only if desired:

```env
TRANSCRIPTION_PROVIDER=huggingface
HUGGINGFACE_TOKEN=your_token
```

This selects the existing hosted Whisper large-v3 endpoint. Neither the local option nor the OpenAI option requires a Hugging Face token.

## Deployment note

A local ASR service on `127.0.0.1` is reachable only from the same computer/server as the Next.js server. A deployed Vercel app cannot reach your personal computer's localhost. For local private testing, run both services on your PC. For a cloud deployment, use a securely reachable private worker or a browser-local model implementation; do not expose the unauthenticated development service to the public internet.

## Limitations and verification

- No actual song was sent during implementation; test with audio you have rights to use and a manually verified reference transcript.
- The local service returns Whisper segment timestamps, not word-level forced alignment.
- The first install and model download require internet; inference can then run locally without sending audio to a hosted transcription API.
