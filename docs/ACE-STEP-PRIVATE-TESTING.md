# ACE-Step 1.5 — private evaluation runbook

Last reviewed: 2026-10-25.

This guide is for the Cro-mix owner testing privately. It does **not** enable generation in the deployed Cro-mix UI and does not make a notebook a production API.

## Recommended order

1. Start with a short, private notebook experiment using the official [ACE-Step 1.5 repository](https://github.com/ACE-Step/ACE-Step-1.5) and its [installation guide](https://github.com/ACE-Step/ACE-Step-1.5/blob/main/docs/en/INSTALL.md).
2. Use the official [API guide](https://github.com/ACE-Step/ACE-Step-1.5/blob/main/docs/en/API.md) to run a local generation request and retrieve the output.
3. Keep a small benchmark set and compare results before paying for a persistent GPU.
4. If notebook sessions, GPU memory or repeatability become a blocker, move the same pinned model/runtime to a rented GPU host such as [RunPod](https://www.runpod.io/pricing) or [Vast.ai](https://vast.ai/).
5. Only after private tests pass, connect a secured worker endpoint to Cro-mix through a server-side adapter.

## Notebook versus rented GPU

| Option | Use now? | Good for | Important limitation |
|---|---|---|---|
| Kaggle Notebooks | Yes, for the first experiment if a suitable GPU is available | Private, interactive feasibility tests | GPU availability and quotas vary; sessions are temporary. Do not rely on it as an always-on public API. |
| Google Colab free tier | Optional alternative | Quick interactive tests | Availability and session limits vary; not a durable public backend. |
| Rented GPU (e.g. RunPod/Vast.ai) | Only if needed | Repeatable API tests and later private integration | Billed GPU time and potentially persistent storage, network traffic and taxes. Check current pricing and shutdown/storage rules. |
| Vercel serverless function | No, not for model inference | Cro-mix UI/API orchestration | Do not run the large model inside the Vercel function; use a separate worker. |

## First benchmark: Croatian Balkan folk-EDM

Use a short segment first, not a full 4:30 track. Test with audio you own or are authorized to process.

Record these fields for every run:

- Date, hardware/GPU and available VRAM.
- ACE-Step repository commit, model/checkpoint and inference settings.
- Task type (cover for source-conditioned cover tests), prompt, language and lyrics.
- Source clip length, output duration, elapsed time and whether the run completed.
- Croatian pronunciation and lyric accuracy; vocal continuity; source melody/rhythm retention; Balkan instrumentation; kick/bass balance; clipping/artifacts.
- Whether the output file downloads and plays correctly.

Suggested score: rate each quality category 1–5. Run at least three variants on the same short source clip so results are comparable. Then test a longer segment only if the short tests are promising. Do not assume that a cover model will perfectly preserve the original melody or vocal identity; evaluate the actual output.

## API lifecycle

The documented ACE-Step API uses an asynchronous workflow:

1. Submit a task to POST /release_task.
2. Poll POST /query_result until success or failure.
3. Retrieve the generated audio using the documented GET /v1/audio?path=... route.

Use the exact request schema in the upstream API documentation for the checked-out version. Do not expose the worker to the public internet without authentication, request limits and network restrictions. Use an API key supported by the deployed ACE-Step version and keep it in server-side environment variables only.

## Cro-mix integration gate

Do not connect the public UI until all checks below pass:

- [ ] A private test can submit a valid audio input and return a playable output.
- [ ] Errors and timeouts are surfaced as failed jobs, not fake successes.
- [ ] Request and response sizes, audio duration and accepted formats are limited.
- [ ] A worker API key is checked server-side; secrets never enter browser bundles or logs.
- [ ] The worker is not an open relay and cannot be used by anonymous callers.
- [ ] Jobs have IDs and explicit states: queued, processing, succeeded, failed, cancelled.
- [ ] Outputs are stored privately and downloaded through short-lived, authorized links.
- [ ] Temporary source and output files are cleaned up according to a documented retention policy.
- [ ] The UI clearly shows that generation is experimental until quality and reliability are validated.
- [ ] Usage rights and applicable model/checkpoint/dependency licenses have been reviewed.

## Cost controls

For rented GPU testing, set a budget alert where supported, use a maximum session window, and verify what is billed while a machine is stopped. Delete the instance and any persistent volume when finished if you do not need to retain them. GPU hourly price alone is not the full cost.

## Security and rights

- Never commit tokens, private audio or credentials to Git.
- Do not put a worker secret in a NEXT_PUBLIC_* variable.
- Do not send private or third-party audio to a hosted service unless its terms, privacy and rights are suitable.
- Only process source music you own or have permission to use. Open-source code or model availability does not grant rights to the source recording or composition.

## Upstream references

- [ACE-Step 1.5 source](https://github.com/ACE-Step/ACE-Step-1.5)
- [Install](https://github.com/ACE-Step/ACE-Step-1.5/blob/main/docs/en/INSTALL.md)
- [API](https://github.com/ACE-Step/ACE-Step-1.5/blob/main/docs/en/API.md)
- [GPU compatibility](https://github.com/ACE-Step/ACE-Step-1.5/blob/main/docs/en/GPU_COMPATIBILITY.md)
- [Inference](https://github.com/ACE-Step/ACE-Step-1.5/blob/main/docs/en/INFERENCE.md)
