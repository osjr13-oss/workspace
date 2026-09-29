# Supabase Setup

Run migrations in order in the Supabase SQL editor (or CLI):

1. `migrations/001_initial_schema.sql`
2. `migrations/002_ai_embeddings.sql` — pgvector + semantic file search
3. `migrations/003_usage_limits.sql` — AI usage tracking + per-user limits row
4. `migrations/004_ops_support.sql` — support tickets + audit logs
5. `migrations/005_billing.sql` — Stripe billing columns on `user_limits`
6. `migrations/006_lifecycle_emails.sql` — tip email preferences + send log
7. `migrations/007_pro_waitlist.sql` — Pro plan waitlist signups
8. `migrations/010_security_hardening.sql` — lock down sensitive writes and add server-side rate limits
9. `migrations/011_email_preferences_opt_in.sql` — make lifecycle tips opt-in
10. `migrations/012_restore_support_request_insert.sql` — restore public support form ticket creation
11. `migrations/013_atomic_ai_quota.sql` — fix + enable atomic AI daily-limit reservation
12. `migrations/014_file_search_fts.sql` — free full-text keyword search over uploaded files
13. `migrations/015_fix_service_role_grants.sql` — fix missing service_role grants (email preferences, audit logs, waitlist export were failing)
14. `migrations/016_block_placeholder_email_domains.sql` — reject signups on always-fake domains like @example.com (bot/spam mitigation)
15. `migrations/20260710214928_reconcile_launch_contracts.sql` — reconcile production ownership triggers, plan limits, review RPC, welcome tracking, grants, defaults, and indexes
16. `migrations/20260711001827_restore_service_role_table_grants.sql` — restore live server access across public tables after production migration drift
17. `migrations/20260711120000_public_deck_sharing.sql` — public share links for flashcard decks (`is_public`, `share_slug`), additive anon-read RLS policies
18. `migrations/20260711120500_referral_unlock.sql` — referral codes, `referrals` table, and Pro-equivalent bonus recognized by `reserve_ai_usage`/`enforce_plan_resource_limits`
19. `migrations/20260724000000_selrano_personalization.sql` — style profiles and durable content memories
20. `migrations/20260813120000_founding_pricing_limits.sql` — Free deck cap 8; Pro/referral AI quota 1500 per UTC month

## Existing production environments

Production historically received some numbered migrations outside the migration-history table. Do not replay the entire list against an existing database. Compare remote migration history and schema first, then apply a focused, idempotent reconciliation migration.

The July 24 inspection confirmed that the live production database already contains `style_profiles`, `content_memories`, and `lifecycle_email_log`, even though the personalization migration filename is not present in tracked remote migration history. Do not apply the personalization migration blindly.

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
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL` (optional, defaults to `claude-sonnet-4-6`)
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `EMBEDDING_API_KEY` (optional, enables RAG over uploaded files)
- `EMBEDDING_MODEL` (optional, default `text-embedding-3-small`)
- `EMBEDDING_BASE_URL` (optional, default OpenAI)
- `AI_DAILY_LIMIT` (optional, default `100`)
- `RESEND_API_KEY`, `EMAIL_FROM`, `SUPPORT_INBOX`, `CRON_SECRET` (email — see `docs/OPERATIONS.md`)
- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPPORT_EMAIL` (optional)
