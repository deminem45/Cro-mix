#!/usr/bin/env python3
"""Evaluate lyric ASR outputs with WER/CER. Standard library only.

CSV columns: id,language,reference_path,hypothesis_path,model,source
Paths are relative to --root unless absolute. Language is hr, sr, bs, or auto.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

WORD_RE = re.compile(r"[\w]+(?:['’][\w]+)*", re.UNICODE)


def normalize_text(text: str, language: str, fold_serbian_script: bool = True) -> str:
    text = unicodedata.normalize("NFKC", text).casefold()
    if fold_serbian_script and language.lower() == "sr":
        text = text.translate(str.maketrans({
            "а":"a","б":"b","в":"v","г":"g","д":"d","ђ":"đ","е":"e","ж":"ž",
            "з":"z","и":"i","ј":"j","к":"k","л":"l","љ":"lj","м":"m","н":"n",
            "њ":"nj","о":"o","п":"p","р":"r","с":"s","т":"t","ћ":"ć","у":"u",
            "ф":"f","х":"h","ц":"c","ч":"č","џ":"dž","ш":"š"
        }))
    return text


def tokens(text: str, language: str, fold_serbian_script: bool) -> list[str]:
    return WORD_RE.findall(normalize_text(text, language, fold_serbian_script))


def edit_distance(a: list[str], b: list[str]) -> int:
    if len(a) < len(b):
        a, b = b, a
    previous = list(range(len(b) + 1))
    for i, left in enumerate(a, 1):
        current = [i]
        for j, right in enumerate(b, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (left != right)))
        previous = current
    return previous[-1]


def score(reference: str, hypothesis: str, language: str, fold_serbian_script: bool) -> dict:
    ref_words = tokens(reference, language, fold_serbian_script)
    hyp_words = tokens(hypothesis, language, fold_serbian_script)
    word_errors = edit_distance(ref_words, hyp_words)
    ref_chars = list("".join(ref_words))
    hyp_chars = list("".join(hyp_words))
    char_errors = edit_distance(ref_chars, hyp_chars)
    return {
        "reference_words": len(ref_words),
        "hypothesis_words": len(hyp_words),
        "word_errors": word_errors,
        "WER": word_errors / len(ref_words) if ref_words else (0.0 if not hyp_words else 1.0),
        "reference_characters": len(ref_chars),
        "character_errors": char_errors,
        "CER": char_errors / len(ref_chars) if ref_chars else (0.0 if not hyp_chars else 1.0),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, help="CSV manifest")
    parser.add_argument("--root", default=".", help="Base directory for relative paths")
    parser.add_argument("--output", default="benchmark-results", help="Output directory")
    parser.add_argument("--keep-serbian-script", action="store_true", help="Do not map Serbian Cyrillic to Latin before scoring")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    out = Path(args.output).resolve()
    out.mkdir(parents=True, exist_ok=True)
    fold_script = not args.keep_serbian_script
    rows = []
    aggregates = defaultdict(lambda: {"samples": 0, "reference_words": 0, "word_errors": 0, "reference_characters": 0, "character_errors": 0})

    with Path(args.manifest).open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"id", "language", "reference_path", "hypothesis_path", "model", "source"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise SystemExit("Manifest missing columns: " + ", ".join(sorted(missing)))
        for row in reader:
            def read_text(field: str) -> str:
                path = Path(row[field])
                if not path.is_absolute():
                    path = root / path
                return path.read_text(encoding="utf-8")
            reference, hypothesis = read_text("reference_path"), read_text("hypothesis_path")
            metrics = score(reference, hypothesis, row["language"], fold_script)
            result = {**{k: row[k] for k in required}, **metrics}
            rows.append(result)
            key = (row["language"], row["model"], row["source"])
            agg = aggregates[key]
            agg["samples"] += 1
            for metric in ("reference_words", "word_errors", "reference_characters", "character_errors"):
                agg[metric] += metrics[metric]

    if not rows:
        raise SystemExit("Manifest contains no samples.")
    with (out / "per-sample.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    summary = []
    for (language, model, source), agg in sorted(aggregates.items()):
        summary.append({
            "language": language, "model": model, "source": source, **agg,
            "WER": agg["word_errors"] / agg["reference_words"] if agg["reference_words"] else None,
            "CER": agg["character_errors"] / agg["reference_characters"] if agg["reference_characters"] else None,
        })
    (out / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    with (out / "summary.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(summary[0]))
        writer.writeheader()
        writer.writerows(summary)
    print(f"Evaluated {len(rows)} transcript(s). Results: {out}")
    print("Compare only equivalent reference text and note whether diacritics/script normalization was enabled.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
