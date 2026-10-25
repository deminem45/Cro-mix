# Deployment

1. Import dem in Vercel: https://vercel.com/new
2. Framework: Next.js; root directory: repository root.
3. Deploy in demo mode with no secrets.
4. Visit /api/health and confirm JSON contains ok: true.
5. Inspect build logs if deployment fails.

Secrets must be stored in Vercel Project Settings → Environment Variables. MUSIC_API_URL and MUSIC_API_KEY are placeholders until a matching provider adapter is implemented. No source audio is uploaded by the current UI.

Not implemented: real audio generation, source upload, stem separation, rendered effects/mastering, database, authentication, job queue and persistent server-side project storage.