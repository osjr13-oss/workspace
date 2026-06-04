# Supabase Setup

Run migrations in order in the Supabase SQL editor (or CLI):

1. `migrations/001_initial_schema.sql`
2. `migrations/002_ai_embeddings.sql` — pgvector + semantic file search
3. `migrations/003_usage_limits.sql` — AI usage tracking + per-user limits row
4. `migrations/004_ops_support.sql` — support tickets + audit logs

## Auth redirect URLs

Add these under **Authentication → URL configuration → Redirect URLs**:

- `http://localhost:3000/auth/callback` (local dev)
- `https://<your-production-domain>/auth/callback`

**Site URL** should be your production origin (e.g. `https://<your-production-domain>`).

Password reset flow: email link → `/auth/callback` → `/auth/update-password`.

## Required project settings

- Email/password auth enabled.
- `workspace-files` bucket is created by migration 001 and remains private.

## Vercel environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `EMBEDDING_API_KEY` (optional, enables RAG over uploaded files)
- `EMBEDDING_MODEL` (optional, default `text-embedding-3-small`)
- `EMBEDDING_BASE_URL` (optional, default OpenAI)
- `AI_DAILY_LIMIT` (optional, default `100`)
- `RESEND_API_KEY`, `EMAIL_FROM`, `SUPPORT_INBOX` (transactional email — see `docs/OPERATIONS.md`)
- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_*_EMAIL` (branding)
