#!/usr/bin/env python3
"""Run a private local audio manifest through Hugging Face Whisper and write benchmark hypotheses.

No audio is committed to the repository. The script reads files from a local folder and
sends their bytes to the configured hosted inference endpoint. Keep the token in an
environment variable; never put it in a manifest or command-line argument.
"""
from __future__ import annotations

import argparse
import csv
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_ENDPOINT = "https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3"
ALLOWED_AUDIO_SUFFIXES = {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".webm", ".mp4"}


def transcribe(path: Path, endpoint: str, token: str, timeout: int, retries: int) -> str:
    if path.suffix.lower() not in ALLOWED_AUDIO_SUFFIXES:
        raise ValueError(f"Unsupported audio extension: {path.suffix or '(none)'}")
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    payload = path.read_bytes()
    if not payload:
        raise ValueError(f"Audio file is empty: {path}")
    request = urllib.request.Request(
        endpoint,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": mime,
            "Accept": "application/json",
        },
    )
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                raw = response.read().decode("utf-8", errors="replace")
            try:
                result = json.loads(raw)
            except json.JSONDecodeError as exc:
                raise RuntimeError(f"Provider returned non-JSON response for {path.name}") from exc
            if isinstance(result, list) and result:
                result = result[0]
            if isinstance(result, dict) and isinstance(result.get("text"), str) and result["text"].strip():
                return result["text"].strip()
            if isinstance(result, dict) and result.get("error"):
                raise RuntimeError(str(result["error"]))
            raise RuntimeError(f"Provider response did not contain transcript text for {path.name}")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:500]
            if exc.code in (429, 500, 502, 503, 504) and attempt < retries:
                time.sleep(min(2 ** attempt, 8))
                continue
            raise RuntimeError(f"Provider HTTP {exc.code} for {path.name}: {detail}") from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt < retries:
                time.sleep(min(2 ** attempt, 8))
                continue
            raise RuntimeError(f"Provider request failed for {path.name}: {exc}") from exc
    raise RuntimeError(f"Transcription failed for {path.name}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, help="CSV with id,language,audio_path,source columns")
    parser.add_argument("--root", default=".", help="Base directory for relative audio paths")
    parser.add_argument("--output", default="benchmark-run", help="Output folder for transcripts and manifest")
    parser.add_argument("--endpoint", default=os.getenv("HF_ASR_ENDPOINT", DEFAULT_ENDPOINT))
    parser.add_argument("--model-label", default=os.getenv("HF_ASR_MODEL_LABEL", "whisper-large-v3"))
    parser.add_argument("--timeout", type=int, default=90)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--pause", type=float, default=1.0, help="Seconds between provider calls")
    args = parser.parse_args()

    token = os.getenv("HUGGINGFACE_TOKEN")
    if not token:
        raise SystemExit("Set HUGGINGFACE_TOKEN in your environment; do not place it in the manifest.")
    if args.timeout < 1 or args.retries < 0 or args.pause < 0:
        raise SystemExit("--timeout must be positive; --retries and --pause cannot be negative.")

    root = Path(args.root).resolve()
    out = Path(args.output).resolve()
    hypotheses = out / "hypotheses"
    hypotheses.mkdir(parents=True, exist_ok=True)
    completed = []
    with Path(args.manifest).open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"id", "language", "audio_path", "source"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise SystemExit("Manifest missing columns: " + ", ".join(sorted(missing)))
        rows = list(reader)
    if not rows:
        raise SystemExit("Manifest contains no audio samples.")
    for index, row in enumerate(rows):
        audio_path = Path(row["audio_path"])
        if not audio_path.is_absolute():
            audio_path = root / audio_path
        if not audio_path.is_file():
            raise SystemExit(f"Audio file not found for sample {row['id']}: {audio_path}")
        print(f"[{index + 1}/{len(rows)}] {row['id']} | {row['source']} | {args.model_label}", flush=True)
        text = transcribe(audio_path, args.endpoint, token, args.timeout, args.retries)
        safe_id = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in row["id"])
        safe_source = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in row["source"])
        filename = f"{safe_id}__{args.model_label}__{safe_source}.txt"
        (hypotheses / filename).write_text(text + "\n", encoding="utf-8")
        completed.append({
            "id": row["id"],
            "language": row["language"],
            "reference_path": row.get("reference_path", ""),
            "hypothesis_path": f"hypotheses/{filename}",
            "model": args.model_label,
            "source": row["source"],
        })
        if index < len(rows) - 1 and args.pause:
            time.sleep(args.pause)

    manifest_path = out / "benchmark-manifest.csv"
    with manifest_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=[
            "id", "language", "reference_path", "hypothesis_path", "model", "source"
        ])
        writer.writeheader()
        writer.writerows(completed)
    print(f"Saved {len(completed)} transcript(s) and manifest: {manifest_path}")
    print("Next, run evaluate.py with --root set to this output folder and include reference_path values in that folder.")
    print("This runner does not perform vocal separation or word-level alignment.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, RuntimeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
