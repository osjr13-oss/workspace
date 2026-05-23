# Meridian

Meridian is a production-oriented AI workspace for projects, notes, files, flashcards, study review, and Groq-powered project-aware chat.

## Local Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in Supabase and Groq values.
3. Run the SQL migration in `supabase/migrations/001_initial_schema.sql`.
4. Start the app with `npm run dev`.

## Environment

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GROQ_API_KEY=
GROQ_MODEL=
```

## Checks

```txt
npm run typecheck
npm run build
```
