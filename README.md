# Selrano

Selrano is a production-oriented AI workspace for projects, notes, files, flashcards, study review, and Groq-powered project-aware chat.

## Local Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in Supabase and Groq values.
3. Run SQL migrations in order from `supabase/migrations/` (001–004).
4. Configure Supabase redirect URLs (see `supabase/README.md`).
5. Optional: configure Resend for transactional email (see `docs/OPERATIONS.md`).
6. Start the app with `npm run dev`.

## Environment

See `.env.example` for the full list. Core variables:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GROQ_API_KEY=
GROQ_MODEL=
NEXT_PUBLIC_APP_URL=
RESEND_API_KEY=
EMAIL_FROM=
SUPPORT_INBOX=
```

## Public pages

| Route | Purpose |
|-------|---------|
| `/support` | Help center + contact form |
| `/security` | Security practices & disclosure |
| `/terms`, `/privacy` | Legal |
| `/help` | In-app support (authenticated) |

## Operations

Enterprise email, branding, support SLAs, and Fortune-500-style checklist: **[docs/OPERATIONS.md](docs/OPERATIONS.md)**

## Auth routes

- `/auth/callback` — exchanges Supabase email links for a session
- `/auth/update-password` — set a new password after reset email

## Checks

```txt
npm run typecheck
npm run build
```
