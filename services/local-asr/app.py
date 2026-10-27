from __future__ import annotations

import os
import tempfile
import threading
from pathlib import Path
from typing import Any

import whisper
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

APP_DIR = Path(__file__).resolve().parent
MODEL_NAME = os.getenv("ASR_MODEL", "small").strip().lower()
LANGUAGE = os.getenv("ASR_LANGUAGE", "").strip().lower()
DEVICE = os.getenv("ASR_DEVICE", "cpu").strip().lower()
MAX_UPLOAD_MB = max(1, int(os.getenv("ASR_MAX_UPLOAD_MB", "100")))
ALLOWED_MODELS = {"tiny", "tiny.en", "base", "base.en", "small", "small.en", "medium", "medium.en", "large", "turbo"}
if MODEL_NAME not in ALLOWED_MODELS:
    raise RuntimeError(f"Unsupported ASR_MODEL={MODEL_NAME!r}; choose one of {sorted(ALLOWED_MODELS)}")

app = FastAPI(title="Cro-mix Local ASR", version="1.0.0")
# The server binds to loopback by default. CORS is deliberately not enabled: the Next.js
# server calls this endpoint server-to-server, so the browser never needs direct access.
model = None
model_lock = threading.Lock()


def get_model():
    global model
    if model is None:
        with model_lock:
            if model is None:
                model = whisper.load_model(MODEL_NAME, device=DEVICE)
    return model


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "provider": "local-whisper", "model": MODEL_NAME, "device": DEVICE, "loaded": model is not None}


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)) -> dict[str, Any]:
    filename = Path(audio.filename or "audio.bin").name
    suffix = Path(filename).suffix[:12] or ".audio"
    payload = await audio.read(MAX_UPLOAD_MB * 1024 * 1024 + 1)
    await audio.close()
    if not payload:
        raise HTTPException(status_code=400, detail="Audio file is empty")
    if len(payload) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Audio exceeds {MAX_UPLOAD_MB} MB limit")

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(prefix="cromix-", suffix=suffix, delete=False) as temp:
            temp.write(payload)
            temp_path = temp.name
        options: dict[str, Any] = {"fp16": DEVICE != "cpu", "verbose": False}
        if LANGUAGE and LANGUAGE in {"hr", "sr", "bs", "en", "de", "it", "sl"}:
            options["language"] = LANGUAGE
        result = get_model().transcribe(temp_path, **options)
        segments = []
        for segment in result.get("segments", []):
            text = str(segment.get("text", "")).strip()
            start, end = segment.get("start"), segment.get("end")
            if text and isinstance(start, (int, float)) and isinstance(end, (int, float)):
                segments.append({"text": text, "timestamp": [float(start), float(end)]})
        text = str(result.get("text", "")).strip()
        return {
            "text": text,
            "chunks": segments,
            "timestampType": "segment" if segments else "unavailable",
            "provider": "local-whisper",
            "model": MODEL_NAME,
            "language": result.get("language") or (LANGUAGE or None),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Local transcription failed: {type(exc).__name__}: {exc}") from exc
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except OSError:
                pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.getenv("ASR_HOST", "127.0.0.1"), port=int(os.getenv("ASR_PORT", "8765")), log_level="info")
