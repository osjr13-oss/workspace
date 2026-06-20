# Staging deployment (Voice Study beta)

Use the **`feature/voice-study`** branch to test the Voice Study Agent on real phones **without** changing production (`main` → selrano.com).

## How Vercel previews work

1. Push the branch:
   ```bash
   git push -u origin feature/voice-study
   ```
2. Vercel (connected to this GitHub repo) builds a **Preview Deployment** automatically.
3. Open the preview URL from:
   - Vercel Dashboard → Project → Deployments → latest `feature/voice-study` deploy
   - Or the GitHub PR/check comment if you open a PR

Preview URLs look like: `https://workspace-git-feature-voice-study-<team>.vercel.app`

## Recommended setup

| Goal | Action |
|------|--------|
| Keep production stable | Do **not** merge to `main` until launch day |
| Test on phone | Open the preview URL in Safari/Chrome → Add to Home Screen |
| Same backend | Preview uses the same Vercel **Production** env vars unless you add Preview-specific overrides |
| Private testing | Share the preview URL only with your team; it is unlisted but not password-protected by default |

### Optional: password protect previews

Vercel Dashboard → Project → **Settings → Deployment Protection** → enable protection for Preview deployments.

### Optional: stable staging subdomain

Vercel → Settings → Domains → assign a domain like `staging.selrano.com` to the **Preview** environment or pin it to the `feature/voice-study` branch (Pro/Team feature).

## Database before testing

Run in Supabase SQL Editor:

```
supabase/migrations/008_voice_study.sql
```

Creates `voice_sessions` with `raw_transcription` staging column.

## Env vars (same as production)

Voice study uses existing Groq keys plus optional Whisper model:

```txt
GROQ_API_KEY=
GROQ_MODEL=
GROQ_WHISPER_MODEL=whisper-large-v3-turbo
```

## Launch checklist (when ready for public)

1. Merge `feature/voice-study` → `main`
2. Confirm migration `008` ran in production Supabase
3. Update landing page copy for Voice Study Agent positioning
4. Promote on selrano.com
