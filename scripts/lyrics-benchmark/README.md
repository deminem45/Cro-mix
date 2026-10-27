# Lyrics transcription benchmark

This harness compares ASR transcripts against a manually verified reference. It uses only Python's standard library; no API key or audio upload is needed to score text files.

## Folder layout

Keep audio files, references, and hypotheses in a private local folder. Do not commit copyrighted audio or full lyrics to the repository.

Example:

```text
private-benchmark/
  manifest.csv
  references/
    song01.txt
  hypotheses/
    whisper-large-v3-song01.txt
```

CSV header (UTF-8):

```csv
id,language,reference_path,hypothesis_path,model,source
song01,hr,references/song01.txt,hypotheses/whisper-large-v3-song01.txt,whisper-large-v3,original_mix
```

Supported language labels: `hr`, `sr`, `bs`, `auto`. `source` is a free-form label, for example `original_mix` or `vocal_stem`.

## Run

From the repository root:

```bash
python scripts/lyrics-benchmark/evaluate.py --manifest private-benchmark/manifest.csv --root private-benchmark --output private-benchmark/results
```

Outputs:
- `per-sample.csv`: metrics for each reference/hypothesis pair.
- `summary.csv` and `summary.json`: aggregate WER/CER by language, model, and source type.

WER is word edit distance divided by the number of reference words. CER is character edit distance divided by reference characters after token normalization. Lower is better. Empty references are reported with a zero denominator policy; do not use those samples for model ranking.

## Croatian / Serbian / Bosnian evaluation cautions

- For Serbian (`sr`), the default scoring maps Cyrillic to Latin so the same spoken words are not counted as completely different solely because of script. Use `--keep-serbian-script` when script fidelity itself matters.
- Diacritics are preserved. Do not strip č/ć/đ/š/ž by default; they can change spelling and sometimes meaning.
- WER/CER were designed for text recognition and do not fully measure whether a transcript captures sung words. A vocal stem can improve intelligibility but can also introduce separation artifacts.
- Build a small, diverse, manually checked reference set (for example 20–50 short excerpts across Croatian, Serbian Latin/Cyrillic, and Bosnian; male/female vocals; clean/noisy mixes; fast/slow passages). Keep all excerpts from the same song in the same split to avoid leakage.
- Compare model and audio source on identical excerpts. Record model version, language setting, date, audio duration, and any preprocessing. Never rank models on different samples.
- Report both aggregate metrics and per-song results. Inspect failures manually, especially repeated choruses, ad-libs, dialect words, names, and instrumental breaks.
- Do not send private audio to hosted services without permission. Keep API keys on the server; never put them in client code.

## Current scope

This is an evaluation harness only. It does not run ASR, separate vocals, create word timestamps, or prove a model is best for singing. Those are separate pipeline stages. Word-level timestamps must come from a real aligner and be checked; they must not be estimated by evenly splitting segment duration.
