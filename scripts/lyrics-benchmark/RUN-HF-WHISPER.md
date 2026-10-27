# Lyrics transcription benchmark

This harness compares ASR transcripts against a manually verified reference. The scoring tool uses only Python's standard library; no API key or audio upload is needed to score text files.

## Privacy and legal notes

Keep audio files, references, and hypotheses in a private local folder. Do not commit copyrighted audio or full lyrics to the repository. The optional hosted runner sends each local audio file to Hugging Face Inference Providers; use only audio you have permission to process. The token is read from `HUGGINGFACE_TOKEN` and must never be placed in a manifest or source code.

## Automated hosted transcription

Create a private folder with a CSV manifest. Use one row per audio source; for fair comparisons, create rows for both the original mix and a vocal stem from the same song, and use the same reference text.

Example private folder:

```text
private-benchmark/
  manifest.csv
  audio/
    song01-original.mp3
    song01-vocal.wav
  references/
    song01.txt
```

Manifest columns (UTF-8):

```csv
id,language,audio_path,reference_path,source
song01,hr,audio/song01-original.mp3,references/song01.txt,original_mix
song01,hr,audio/song01-vocal.wav,references/song01.txt,vocal_stem
```

Supported language labels: `hr`, `sr`, `bs`, `auto`. `source` is a free-form label, such as `original_mix` or `vocal_stem`.

Set the token in your shell, not in a file:

```bash
# macOS/Linux
export HUGGINGFACE_TOKEN="hf_your_token"
python scripts/lyrics-benchmark/run_hf_whisper.py \
  --manifest private-benchmark/manifest.csv \
  --root private-benchmark \
  --output private-benchmark/results
```

PowerShell:

```powershell
$env:HUGGINGFACE_TOKEN = "hf_your_token"
python scripts/lyrics-benchmark/run_hf_whisper.py --manifest private-benchmark/manifest.csv --root private-benchmark --output private-benchmark/results
```

The runner writes hypothesis text files and `benchmark-manifest.csv`. It retries transient provider errors twice by default and pauses between requests. You can configure the endpoint with `HF_ASR_ENDPOINT` and the display label with `HF_ASR_MODEL_LABEL`. Do not use a model label to imply a different model was actually served; record the exact endpoint/model/version used.

## Score results

The generated manifest uses absolute paths for hypotheses. Run the evaluator with the same root used for the input manifest so relative reference paths resolve:

```bash
python scripts/lyrics-benchmark/evaluate.py \
  --manifest private-benchmark/results/benchmark-manifest.csv \
  --root private-benchmark \
  --output private-benchmark/results/scores
```

Outputs:
- `per-sample.csv`: metrics for each reference/hypothesis pair.
- `summary.csv` and `summary.json`: aggregate WER/CER by language, model, and source type.

WER is word edit distance divided by reference words. CER is character edit distance divided by reference characters after token normalization. Lower is better. Empty references should not be used for model ranking.

## Croatian / Serbian / Bosnian evaluation cautions

- For Serbian (`sr`), default scoring maps Cyrillic to Latin so the same spoken words are not counted as completely different solely because of script. Use `--keep-serbian-script` when script fidelity itself matters.
- Diacritics are preserved. Do not strip č/ć/đ/š/ž by default; they can change spelling and sometimes meaning.
- Compare models and source types on identical excerpts. Keep all excerpts from one song in the same split to avoid leakage.
- Start with 20–50 manually checked excerpts across Croatian, Serbian Latin/Cyrillic, and Bosnian, male/female vocals, clean/noisy mixes, and fast/slow passages.
- Report both aggregate metrics and per-song results. Inspect repeated choruses, ad-libs, dialect words, names, and instrumental breaks manually.
- The current hosted runner sends raw audio bytes to the configured ASR endpoint and expects a JSON response with a `text` field. It does not force a language parameter, separate vocals, or generate timestamps. Verify the provider's current endpoint contract before switching providers.

## Scope and next stage

This is an evaluation harness, not proof that a model is best for singing. A vocal stem may improve intelligibility but can also introduce separation artifacts. This runner only tests the selected Whisper endpoint; comparing other models requires configuring their real endpoints/adapters and recording which model actually produced each transcript.

Word-level timestamps must come from a real aligner and be checked; they must not be estimated by evenly splitting segment duration.
