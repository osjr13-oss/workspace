# Selrano

Selrano is a production-oriented AI workspace for projects, notes, files, flashcards, study review, and Groq-powered project-aware chat.

## Local Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in Supabase and Groq values.
3. Run the complete migration sequence in `supabase/migrations/`; later migrations contain required billing, security, quota, and search fixes.
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
| `/pricing` | Free vs Pro plans |

## Billing

Stripe Free + Pro tiers: **[docs/BILLING.md](docs/BILLING.md)**

## First-time setup (env, DB, email)

**Start here if features are not wired yet:** **[docs/SETUP.md](docs/SETUP.md)** — step-by-step for Supabase migrations, Vercel env, Resend on selrano.com, and auth redirects.

```bash
npm run setup:check   # after copying .env.example → .env.local
```

## Operations

Enterprise email, branding, support SLAs, and Fortune-500-style checklist: **[docs/OPERATIONS.md](docs/OPERATIONS.md)**

## Contributor handoff

Before continuing product work, read **[AGENTS.md](AGENTS.md)** and **[docs/HANDOFF.md](docs/HANDOFF.md)** for the current production architecture, deployed fixes, migration-history caution, verification workflow, and next priorities.

## Auth routes

- `/auth/callback` — exchanges Supabase email links for a session
- `/auth/update-password` — set a new password after reset email

## Checks

```txt
npm run typecheck
npm run lint
npm audit --omit=dev --audit-level=high
npm run build
```
