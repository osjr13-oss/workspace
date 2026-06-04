# Selrano

Selrano is a production-oriented AI workspace for projects, notes, files, flashcards, study review, and Groq-powered project-aware chat.

## Local Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in Supabase and Groq values.
3. Run SQL migrations in order from `supabase/migrations/` (001, 002, 003).
4. Configure Supabase redirect URLs (see `supabase/README.md`).
5. Start the app with `npm run dev`.

## Environment

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GROQ_API_KEY=
GROQ_MODEL=

# Optional — semantic search over file chunks (OpenAI-compatible embeddings API)
EMBEDDING_API_KEY=
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_BASE_URL=https://api.openai.com/v1

# Optional — daily cap on AI routes (default 100)
AI_DAILY_LIMIT=100
```

## Auth routes

- `/auth/callback` — exchanges Supabase email links (signup, recovery) for a session
- `/auth/update-password` — set a new password after a reset email link

Password reset emails redirect through `/auth/callback?next=/auth/update-password`.

## Checks

```txt
npm run typecheck
npm run build
```
