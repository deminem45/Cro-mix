# Cro-mix Studio

Responsive Next.js music workspace for planning AI covers/remixes, local audio preview, lyrics editing and style controls.

## Deploy to Vercel
Import this repository at https://vercel.com/new. Select Next.js, keep the repository root as the root directory, and deploy without environment variables for demo mode. Check /api/health after deployment.

## Local development
Run npm install, copy .env.example to .env.local, then run npm run dev. Open http://localhost:3000.

## Included
- Responsive studio interface and Balkan/electronic style presets.
- Browser-local audio file preview.
- Lyrics editing and TXT export.
- Tempo, melody and energy controls.
- Health and demo generation API endpoints.

## Honest limitations
This is an online-ready prototype, not a working AI audio renderer. Demo mode does not generate audio. Real source-conditioned covers need a compatible audio-input model, secure upload, asynchronous job tracking, output storage, and playable downloads. Stem separation, effects rendering, mastering, authentication, database persistence and job queue are not implemented. Do not expose API secrets in client code.

Only upload music you own or have permission to process. The audio preview currently stays in the browser.