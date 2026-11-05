# Selrano

Selrano is a calm AI workspace for your own material: notes, files, and the web in one place. Ask a question and get an answer that cites the exact page it came from, then keep what matters as notes and review cards. Chat is the signed-in home, supported by projects, private uploads, web search, flashcards, and study review.

Chat streams from OpenAI GPT, with Groq as the fallback; Groq also runs background work, flashcards, transformations, and image OCR. Selrano learns writing preferences, stores durable memories, and uses owned workspace material through authenticated tools. Public pricing describes capabilities without advertising exact AI message allowances.

Sign-ups are currently closed; the public pages are open and offer a waitlist.

## Local Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in Supabase, OpenAI, and Groq values.
3. Review the migration history and live schema before applying anything. The personalization tables are defined in `20260724000000_selrano_personalization.sql`, but the production tables already exist even though that filename is not present in tracked production migration history.
4. Configure Supabase redirect URLs (see `supabase/README.md`).
5. Optional: configure Resend for transactional email (see `docs/OPERATIONS.md`).
6. Start the app with `npm run dev`.

## Environment

See `.env.example` for the full list. Core variables:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=                     # primary chat model
GROQ_API_KEY=                       # fallback and background AI
GROQ_MODEL=openai/gpt-oss-120b      # optional; also GROQ_FALLBACK_MODEL, GROQ_BACKGROUND_MODEL, GROQ_VISION_MODEL
TAVILY_API_KEY=                     # live web search in chat
NEXT_PUBLIC_APP_URL=
RESEND_API_KEY=
EMAIL_FROM=
```

## Public pages

| Route | Purpose |
|-------|---------|
| `/` | Landing page with the live product demo and waitlist |
| `/pricing` | Free vs Pro plans |
| `/guides`, `/changelog` | Guides and release notes |
| `/signup` | Sign-ups are closed; joins the waitlist |
| `/signin`, `/reset-password` | Account access |
| `/d/[slug]` | Shared flashcard decks |
| `/security` | Security practices and disclosure |
| `/terms`, `/privacy` | Legal |

## Design

Read **[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)** before changing any UI: editorial calm, warm paper, one navy accent, Newsreader titles, Inter interface text, and no pill badges. **[design-qa.md](design-qa.md)** is the checklist for shipping UI changes.

## Billing

Stripe Free + Pro tiers: **[docs/BILLING.md](docs/BILLING.md)**

## First-time setup (env, DB, email)

**Start here if features are not wired yet:** **[docs/SETUP.md](docs/SETUP.md)** for Supabase migrations, Vercel environment variables, Resend on the existing selrano.com domain, and auth redirects.

```bash
npm run setup:check
```

## Operations

Email, branding, and trust checklist: **[docs/OPERATIONS.md](docs/OPERATIONS.md)**. There is currently no support channel.

## Contributor handoff

Before continuing product work, read **[AGENTS.md](AGENTS.md)** and **[docs/HANDOFF.md](docs/HANDOFF.md)** for the current production architecture, deployed fixes, migration-history caution, verification workflow, and next priorities.

## Auth routes

- `/auth/callback` exchanges Supabase email links for a session
- `/auth/update-password` sets a new password after a reset email

## Checks

```txt
npm run typecheck
npm run lint
npm audit --omit=dev --audit-level=high
npm run build
npm run test:e2e   # builds the app and runs it against fake Supabase and Groq; needs no accounts
rg -n '\x{2014}' app components lib
git diff --check
```
