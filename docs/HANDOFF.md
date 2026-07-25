# Selrano production handoff

Last updated: **July 24, 2026**

## Current state

- Production: `https://selrano.com` (redirects to `https://www.selrano.com`)
- Repository: `osjr13-oss/workspace`
- Production branch: `main`
- Supabase project ref: `ucuppqutbzbwekyxrkwr`
- AI providers: Anthropic first, defaulting to `claude-sonnet-4-6`, with Groq fallback when Anthropic fails before streaming any text
- Billing: Stripe Free + Pro at $19/month
- Email: Resend for application mail; Supabase Auth for confirmation/reset mail
- Product feature flags: **none**. Shipped capabilities are always enabled.
- Obsolete Vercel feature environment variables and `FLAGS_SECRET` were removed on July 11.
- Current main commit: `6c5d771`, merging the adaptive AI transformation and the July 24 chat, email, memory, and pricing improvements.
- The merge was pushed to `main`. The resulting Vercel production deployment was not independently observed from this environment.

## Product positioning and UI direction

- Position Selrano as a calm AI workspace for a user's own materials: projects, notes, private uploads, grounded chat, quick transformations, flashcards, and review.
- Do not let the homepage or onboarding revolve entirely around flashcards. Flashcards are useful, but Selrano should not read like a Quizlet competitor.
- The preferred public framing is materials first: gather source material, work with context, then review what matters.
- Avoid generic emoji-style decoration or low-effort visual shorthand in product and marketing UI. Use restrained text structure and intentional icons only when they clarify an action, navigation item, or status.
- Keep the Selrano name across the product, domain, and email. Do not revive the imported product's previous brand.
- Public pricing and acquisition pages should sell capability and outcomes without advertising exact AI message allowances. Authenticated billing may still show current usage and limits.
- Chat presentation should feel calm and premium: soft user prompt cards, borderless editorial assistant prose, visible response actions, and the Selrano thinking trace while waiting.
- Never use the Unicode em dash character in user-visible copy, stored chat content, citations, lifecycle email content, or AI output.

## Confirmed production journeys

The July 10 authenticated production audit confirmed:

- authentication and protected routes
- project creation
- note creation and persistence
- project-aware AI chat
- normal AI chat streaming through repeated incremental UI updates
- authenticated AI workspace actions with streamed confirmation
- signed resumable TXT upload, extraction, and ready status
- AI flashcard generation from an uploaded file
- manual flashcard creation
- study review persistence through `record_study_review`
- Free-plan usage counters
- logout and protected-route redirect

Test content remains clearly labeled under **`E2E Launch Check — Jul 10`** and **`E2E AI Action Check — Jul 10`**. Do not remove it without owner approval.

## Launch-hardening work deployed

- Ownership validation was added across project-linked records and AI routes.
- Free project/deck limits are enforced transactionally in Postgres.
- Study reviews use an atomic RPC.
- Dashboard counts are exact instead of truncated client estimates.
- UI writes report failures instead of silently ignoring them.
- Account deletion cancels an active Stripe subscription and removes Storage objects.
- Checkout prevents duplicate upgrades; billing UI waits for webhook truth.
- `invoice.paid` restores subscription state; payment failure does not revoke access prematurely.
- Welcome email delivery happens after confirmed signup and is tracked once per user.
- Welcome delivery is awaited before an immediate signup redirect, retries on the next authenticated app load, and is recovered by the daily email job if still unsent.
- Production `service_role` table and sequence grants were restored after drift caused Settings, welcome-email, support, audit, billing, and account-management server writes to fail.
- Files upload directly to Supabase with signed TUS, then process server-side.
- Chat/project/deck/source ownership is verified server-side.
- Normal chat streams incrementally and persists complete or partial responses before closing.
- Explicit workspace requests can search materials, create notes, and create flashcard decks; the final response streams.
- Ranked full-text file search is always enabled, with substring and first-chunk fallbacks.
- All product feature flags and their environment variables were removed.
- Desktop/mobile logout is accessible and uses local-session scope.
- CI blocks on typecheck, lint, production dependency audit, and build.
- Anthropic is the preferred provider; Groq remains the fallback and tool-capable provider.
- Selrano learns a style directive from conversation history and uses durable content memories when relevant.
- Established accounts with no memories can bootstrap up to 12 durable facts from as many as 80 earlier user messages on the next chat request.
- Explicit recall prompts such as "what do you remember about me?" return the strongest stored memories without requiring lexical overlap.
- User messages use soft prompt cards; assistant responses use a readable editorial layout with copy, read-aloud, and regenerate actions.
- The waiting state uses a three-stage Selrano thinking trace instead of a generic spinner.
- Conversations can be deleted directly from the chat list, including on touch layouts.
- The Study navigation icon now uses a modern brain-circuit mark.
- Public pricing and guide copy no longer advertise exact AI message allowances.
- Opted-in accounts at least seven days old are eligible for a weekly workspace check-in, subject to a seven-day minimum between lifecycle emails.
- Lifecycle sends are claimed in the log before delivery to prevent duplicates. A failed send removes its claim so it can be retried.

## Production database

The tracked production migration history observed during the audit was:

1. `20260706160103_pro_waitlist_launch_email`
2. `20260706163345_restore_support_request_insert`
3. `20260710214928_reconcile_launch_contracts`
4. `20260711001827_restore_service_role_table_grants`

The production schema also contains objects from older numbered SQL files that were applied outside migration tracking. The reconciliation migration is intentionally idempotent. Never assume `supabase db push` is safe without comparing remote history and schema.

The July 24 production inspection confirmed that `style_profiles`, `content_memories`, and `lifecycle_email_log` exist in the live database. `20260724000000_selrano_personalization.sql` is not present in the tracked remote migration list, so do not apply it blindly. Compare the live schema first.

Key live contracts verified after reconciliation:

- lifecycle emails default to opt-out
- welcome-email delivery tracking exists
- 7 ownership triggers exist
- 2 plan-limit triggers exist
- `record_study_review` is available to authenticated users
- trigger-only privileged functions are not executable through the public API
- `service_role` has all required public-table and sequence privileges, including default privileges for future objects

The July 11 email incident was caused by production migration drift: the server role had schema access but was missing table privileges. The live grant repair fixed the Email preferences error immediately. The signed-in production check confirmed **Send tips & feature reminders** now persists successfully. `RESEND_API_KEY`, `EMAIL_FROM`, `SUPPORT_INBOX`, and `CRON_SECRET` are present in Vercel production/preview configuration. The July 10 account affected by the incident was recovered through the deployed welcome-email batch at `2026-07-11 00:31:51 UTC`; the database shows one welcome audit event, confirming one delivery without duplication.

The July 24 lifecycle investigation found that preferences were saving correctly, but active established users could age out of every narrow tip campaign. The live database had no lifecycle-email log rows for the opted-in active account. The new weekly check-in closes that eligibility gap. A real external lifecycle email was not triggered manually during local verification, so confirm the next scheduled production run and its log entry before treating delivery as fully observed.

The July 24 memory investigation found historical user messages but no content-memory rows for the established active account. The application now backfills durable memories from earlier conversation history when the memory table is empty, then treats direct recall questions as a request for the strongest stored facts.

## AI request lifecycle

1. Authenticate the user and resolve owned thread/project context.
2. Reserve daily AI usage atomically.
3. Persist the user message.
4. Load recent conversation history, project context, style profile, and relevant durable memories.
5. If an established account has no memories, extract durable facts from earlier user messages before answering.
6. Route explicit workspace requests through authenticated tools.
7. Stream Anthropic text when configured. Fall back to Groq only if Anthropic fails before any text is emitted.
8. Remove em dashes at every model-output boundary.
9. Persist the assistant response before closing the browser stream.
10. Extract new durable memories and update the style profile after the exchange.
11. Reload the thread from database truth.

Do not reintroduce an environment switch for streaming, AI actions, or full-text search.

## Validation and release

```bash
npm install
npm run setup:check
npm run typecheck
npm run lint
npm audit --omit=dev --audit-level=high
npm run build
rg -n '\x{2014}' app components lib
git diff --check
```

Push to `main`, watch GitHub Actions, allow the Vercel deployment to turn over, and verify the real production flow. A passing Next.js build does not validate Supabase migrations, Storage, Stripe webhooks, Groq streaming, or Resend delivery.

## Known limitations and next priorities

1. Confirm the `6c5d771` Vercel production deployment, then smoke-test premium chat rendering, direct list deletion, and explicit memory recall on the real account.
2. Confirm the next scheduled lifecycle-email run creates a `weekly_digest_YYYY-MM-DD` log entry and delivers to the opted-in account.
3. Update GitHub Actions from `actions/checkout@v4` and `actions/setup-node@v4`; GitHub currently warns that their Node 20 action runtime is deprecated.
4. Address Supabase performance-advisor warnings: missing foreign-key indexes and RLS policies that call `auth.uid()` without a scalar subquery.
5. Supabase leaked-password protection is unavailable on the current plan. Email confirmation is currently disabled, so signup creates an immediate session and the Resend welcome email is the first account email.
6. Add production error tracking and product analytics before scaling paid acquisition.
7. Add automated browser regression coverage for signup, notes, upload, chat streaming, memory backfill, flashcard generation, study, billing state, and logout.

## Recent release commits

- `6c5d771` — merge the adaptive Selrano AI experience into `main`
- `9c9a4b1` — polish chat and repair lifecycle systems
- `6556d2f` — transform Selrano into an adaptive AI workspace
- `97c3ce6` — remove generic marketing icons
- `710f2be` — refine Selrano product positioning
- `33e0c7f` — repair email delivery and production grants
- `028906f` — ship all product capabilities by default
- `6d51a27` — stream AI chat responses by default
- `610a977` — use reliable local sign out
- `f90120b` — make sign out reliably accessible
- `a9a4eb8` — fix signed resumable uploads
- `e8aa14c` — harden launch-critical product flows
