# Cro-mix Studio — AI provider roadmap

Last reviewed: 2026-10-25.

This separates free-to-self-host software from limited free hosted quotas. Open-source tools still incur GPU, storage, bandwidth and operations costs. Free quotas can change and are not a production SLA.

## Phase 1 — free-first baseline

| Capability | Candidate | Cost model | Notes |
|---|---|---|---|
| Full-song generation / cover experiments | [ACE-Step 1.5](https://github.com/ACE-Step/ACE-Step-1.5) | No per-call vendor fee when self-hosted | First model to evaluate for source-conditioned covers, remixing and original generation. Run its REST API outside Vercel, ideally on a GPU host. Benchmark Croatian lyrics, 3–5 minute tracks, fidelity, queue time and GPU memory. |
| Stem separation | [Demucs](https://github.com/adefossez/demucs) | Self-hosted | 4-stem baseline; GPU preferred. CPU can be slow. |
| BPM / audio analysis / DSP | [librosa](https://github.com/librosa/librosa) + [FFmpeg](https://ffmpeg.org/) | Self-hosted | Metadata, tempo estimates, conversion, trim, fade, loudness and deterministic transforms. |
| Combined HTTP toolkit | [AudioLLa](https://github.com/psyb0t/docker-audiolla) | Self-hosted community project | Optional experiment only. Review source, pin image digest and benchmark endpoints; not an official vendor SLA. |
| Limited hosted inference | [Hugging Face Inference Providers](https://huggingface.co/docs/inference-providers) | Free allowance then provider-specific billing | Can test supported speech/transcription models; not a guaranteed free cover engine. |
| Limited noise cleanup | [Audo API](https://audo.ai/docs/api) | Free trial endpoints with daily limits | Limited audio portions, a few times daily. Not suitable as a production dependency. |
| Audio-to-audio experiments | [Stable Audio API](https://docs.stability.ai/api-reference/stable-audio/audio-to-audio) | Trial credits may be available; then credits | Audio variation/style transfer, not guaranteed faithful covers. API docs prohibit uploading copyrighted content; do not send third-party commercial tracks. Confirm current account terms. |

### Reality check

A dependable, unlimited, commercial-grade full-song cover/remix API with a guaranteed free tier was not verified. The realistic free-first path is self-hosted open models plus DSP, using hosted trial APIs only for evaluation.

### Implementation order

1. Add server-side provider registry and provider readiness endpoint.
2. Run ACE-Step 1.5 as an isolated worker/service, not inside a Vercel serverless function.
3. Add secure upload validation: file size, duration, MIME, rate limits and user confirmation of rights.
4. Add durable jobs with states: queued, processing, succeeded, failed and cancelled.
5. Implement and test an ACE-Step REST adapter against the deployed API schema.
6. Add Demucs and FFmpeg/librosa as separate processing jobs.
7. Store outputs in private object storage and issue short-lived download URLs.
8. Add user quotas, retention/deletion controls, observability and abuse protection.

Never report a generation as complete unless a real output file was returned, verified and stored.

## Phase 2 — paid providers

| Capability | Candidate | Why | Caveats |
|---|---|---|---|
| Song generation, reference audio and stems | [Mureka API](https://platform.mureka.ai/) | Broad music API product with generation, custom models, vocal cloning, extend/edit and stem workflows | Confirm current account access, rights, model access and pricing. |
| Stem separation / noise reduction | [LALAL.AI API](https://www.lalal.ai/api/) | Dedicated separation and cleanup service | Confirm commercial API plan and unit costs. |
| Professional stem separation | [AudioShake](https://developer.audioshake.ai/separate-stems) | Async task workflow with multiple stem targets | Secure asset upload and task polling/webhooks; confirm price. |
| AI mixing/mastering | [RoEx TONN](https://tonn.roexaudio.com/) | Mix/master, loudness compliance and processed stems | Credit-based; verify pricing and trial credits. |
| Audio-to-audio and original music | [Stable Audio API](https://docs.stability.ai/api-reference/stable-audio/audio-to-audio) | Text-to-audio, audio-to-audio and inpainting | Do not submit copyrighted material under the provider's stated restriction. |
| Hosted custom inference | [fal](https://fal.ai/docs/model-api-reference/audio-api/overview) | Broad audio model catalog and serverless inference | Pay-as-you-go; model-specific licenses and output URL privacy matter. |

MiniMax's current music API documentation notes changes affecting new API users and discontinuation of free endpoints. Do not make it a baseline dependency without fresh confirmation.

## Architecture rules

- Keep vendor secrets server-side only; browsers call Cro-mix endpoints.
- Each adapter must validate inputs, submit jobs, poll status, validate results, enforce timeouts and normalize errors.
- Jobs need idempotency keys; retries must not double-charge.
- Record estimated cost before submit and actual usage after completion.
- Use private storage and expiring URLs; do not expose vendor output URLs indefinitely.
- Require rights confirmation before third-party uploads.
- Model license, provider terms and user rights are separate checks.
- Use capability-based fallback: Demucs can replace another stem service, but a text-to-music model must not be presented as a faithful cover fallback.

## Current app status

The /api/providers endpoint lists candidates and whether relevant environment variables exist. This is a catalog/readiness view, not proof that generation is wired up. /api/generate remains disabled until the real audio job pipeline is implemented and tested.
