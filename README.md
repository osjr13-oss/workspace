# Selrano

Selrano is a calm website security workspace for people building with AI. Enter a public URL, review prioritized findings and evidence, copy fix prompts into your AI builder, and ask a report-aware copilot for help.

The scanner is adapted from `osjr13-oss/launchguard`. Authentication, Stripe billing, branding, and the streaming Anthropic/Groq providers stay in Selrano. Previous workspace content remains available from Settings.

The security transformation is ready for release, with its focused production database migration applied. See [the security migration handoff](docs/SECURITY_MIGRATION.md) for source provenance, storage, validation, and the production cutover steps. `docs/HANDOFF.md` retains the earlier production record.

## Local Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in Supabase, Anthropic, and Groq values.
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
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
GROQ_API_KEY=
GROQ_MODEL=
TAVILY_API_KEY=
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

**Start here if features are not wired yet:** **[docs/SETUP.md](docs/SETUP.md)** for Supabase migrations, Vercel environment variables, Resend on the existing selrano.com domain, and auth redirects.

```bash
npm run setup:check
```

## Operations

Enterprise email, branding, support SLAs, and Fortune-500-style checklist: **[docs/OPERATIONS.md](docs/OPERATIONS.md)**

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
rg -n '\x{2014}' app components lib
git diff --check
```
