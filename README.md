# Cro-mix Studio

Responsive Next.js music workspace for planning AI covers/remixes, local audio preview, lyrics editing and style controls.

## Deploy to Vercel
Import this repository at https://vercel.com/new. Select Next.js, keep the repository root as the root directory, and deploy without environment variables for demo/catalog mode. Check /api/health and /api/providers after deployment.

## Local development
Run npm install, copy .env.example to .env.local, then run npm run dev. Open http://localhost:3000.

## Included
- Responsive studio interface and Balkan/electronic style presets.
- Browser-local audio file preview.
- Lyrics editing and TXT export.
- Tempo, melody and energy controls.
- Health endpoint and safe AI-provider catalog/readiness endpoint.
- Free-first and paid provider research in docs/AI-PROVIDERS.md.

## Provider strategy
Start with open-source/self-hosted tools for music generation experiments (ACE-Step 1.5), stem separation (Demucs), and deterministic audio processing (librosa/FFmpeg). These are not zero-cost to operate: GPU, storage and bandwidth can cost money. Use hosted free quotas only for limited testing. Add paid APIs for professional stem separation, mastering and generation only after verifying pricing, commercial terms and supported workflows.

All vendor secrets must stay server-side. The current provider catalog does not send audio to any vendor and does not perform generation.

## Honest limitations
This is an online-ready prototype, not yet a working AI audio renderer. Demo mode does not generate audio. Real source-conditioned covers need a compatible model, secure upload, asynchronous job tracking, output storage and playable downloads. Stem separation, effects rendering, mastering, authentication, database persistence and job queue are not yet implemented. Do not expose API secrets in client code.

Only upload music you own or have permission to process. The audio preview currently stays in the browser.
