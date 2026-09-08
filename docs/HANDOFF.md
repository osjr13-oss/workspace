# Selrano production handoff

## Current direction and handoff: September 8

**Build Selrano as a versioned AI thinking partner for exploring ideas and making decisions.** Security is the current deployed product, not the future development focus. The user stepped away from security because they do not feel able to deliver the required accuracy as a solo, nontechnical founder. They rejected chat-import tools and browser extensions due to friction and privacy risks.

The active branch is `codex/selrano-1-prototype`, pushed to GitHub with implementation commit `16df5e0`. The local checkout is `/Users/osmanosman/workspace-prototype`; the original checkout `/Users/osmanosman/workspace` remains on `main`. Do not merge, deploy, promote a preview, change billing, or migrate customer data without a new explicit request. Main's production application remains at `f575e51`.

### User feedback and next priorities

The user tried Selrano 1 and praised its speed, intelligence, and tone. They strongly rejected the visual design. Preserve conversational strengths; do not treat the prototype UI as accepted. A substantial visual redesign is the next likely iteration, but no new design direction has been approved. This context-update task does not authorize that redesign.

The user wants an AI with its own identity, meaningful versioned releases, and eventually model training. Start with measurable improvements to the AI system using an existing provider, then consider fine-tuning later. Do not market the current system as a model trained from scratch.

### Prototype boundaries and verification

See [PROTOTYPE.md](PROTOTYPE.md). Current release `selrano-1.0.1` uses Groq `openai/gpt-oss-120b`. It has streaming, local chat history, release attribution, retry/stop, deletion, and a Where we are recap. No database, cross-chat memory, account connections, browsing, analytics, or training collection. Only the active conversation is sent to Groq, under that provider's policies. Local storage is not encrypted.

The running local preview is http://127.0.0.1:3210. Use `npm run prototype` to restart development, or `npm run build` then `npm run start -- --hostname 127.0.0.1 --port 3210` for the built preview. The ignored environment file contains only the Groq configuration. Hosted previews intentionally reject access; a Vercel Ready status does not mean the prototype is a hosted public product.

87 tests, typecheck, lint, production build, dependency audit, and browser checks passed. Twenty complete fictional baseline/Selrano pairs are in the local ignored `.prototype-evaluation/` directory; scenarios and the reproduction script are committed. User preference ratings and extended real-conversation trials remain pending. Positive initial feedback must not be reported as a completed 15/20 benchmark.

### Historical records

Everything below records earlier production work. It does not override the current direction or authorize reintroducing old product features.

## September 6 security follow-up

Added a per-request nonce CSP, frame blocking, nosniff, referrer and permissions policies, a standards-based security.txt, and visible privacy/terms/support links on sign-in and sign-up. Documents now render dynamically so Next.js can apply a matching nonce; this trades static HTML caching for the script policy. The policy follows https://nextjs.org/docs/15/app/guides/content-security-policy; disclosure fields follow https://securitytxt.org/.

Production logs traced the Copilot failure to an invalid Anthropic key. At the user's request, removed ANTHROPIC_API_KEY from Vercel Production/Preview and local configuration. The configured Groq model was unavailable; verified streaming with openai/gpt-oss-120b and updated GROQ_MODEL locally and in Vercel Production/Preview. These changes took effect with production commit `f575e51`. No secrets were committed.

Validation: typecheck, lint, production build, 68 tests, production dependency audit (zero vulnerabilities), nonce/header and auth-link HTTP checks, and interactive sample-report browser check passed. Production verification passed: Copilot streamed and persisted, and the rescan found zero findings across ten public pages (100/100 within passive scan coverage).

## September 6 security transformation: released

The user requested replacing the workspace product with LaunchGuard-backed website security scanning while preserving Selrano branding and its calm design. The local implementation now includes scans, private history, findings, fix prompts, report export, and streaming report-aware Copilot. Existing workspace data and routes remain available through Settings.

Read [SECURITY_MIGRATION.md](SECURITY_MIGRATION.md) before releasing this change. The user authorized commit and push. The focused scan-storage migration was applied in production as `20260906114947_security_scanner`, with RLS and grants verified, before the application push. Application commit `bf16895` was pushed to `main`; GitHub Actions run `34031423715` passed and Vercel confirmed the deployment. The public homepage, sample report, and signed-out route protection were verified on `www.selrano.com`. Full saved-scan/Copilot production verification still requires a signed-in browser session. The remainder of this handoff records the previous production product, not the new local implementation.

Last updated: **August 3, 2026**

## Historical August 3 state

- Production: `https://selrano.com` (redirects to `https://www.selrano.com`)
- Repository: `osjr13-oss/workspace`
- Production branch: `main`
- Supabase project ref: `ucuppqutbzbwekyxrkwr`
- AI providers: Anthropic first, defaulting to `claude-sonnet-4-6`, with Groq fallback when Anthropic fails before streaming any text
- Billing: Stripe Free + Pro at founding/introductory **$6.99/month** (see `lib/plans.ts` `priceKind: "founding"`)
- Email: Resend for application mail; Supabase Auth for confirmation/reset mail
- Product feature flags: **none**. Shipped capabilities are always enabled.
- Obsolete Vercel feature environment variables and `FLAGS_SECRET` were removed on July 11.
- Current main commit: `2b1a908`, merging the `landing-page-aesthetics` branch (cursor-spotlight and scroll-reveal treatment for the landing page and pricing cards) on top of the July 25 web-search/icon fixes and the July 24 adaptive AI transformation merge (`6c5d771`).
- The July 25 commits (`79d56c3`, `de0b2c2`, `e9fd5f5`) and the August 3 landing-page merge (`2b1a908`) were all pushed to `main`, and each Vercel production deployment was confirmed via `vercel logs` / the GitHub commit status API from this environment.

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
- The chat AI tool-decision pass now runs on every message instead of only messages matching a keyword gate, and offers `web_search` alongside the existing workspace tools so the model itself judges when it needs current information.
- Malformed Groq tool-call output (`llama-3.3-70b-versatile` occasionally emits `<function=...>` as plain text instead of structured JSON) is parsed and recovered from the rejected error body instead of being silently discarded.
- The Settings billing panel no longer shows the redundant AI today/Projects/Decks usage counters.
- Generic sparkle iconography was replaced with context-specific icons: a crown for Pro/premium actions, the Selrano brand mark for "Made with Selrano" attribution, and the existing wand icon unified across all AI-transform actions (flashcard generation, note transforms, quick actions).
- The landing page and pricing cards use a cursor-tracking spotlight/glow border (`components/spotlight-card.tsx`, `components/use-spotlight.ts`) and scroll-in reveal animation (`components/reveal.tsx`), built on a new `framer-motion` dependency. See `DESIGN_SYSTEM.md`'s Motion section for the reusable pattern.

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
6. Run the tool-decision pass on every message, offering workspace search, live web search, note creation, and flashcard creation; the model decides which, if any, to call.
7. Stream Anthropic text when configured. Fall back to Groq only if Anthropic fails before any text is emitted.
8. Remove em dashes at every model-output boundary.
9. Persist the assistant response before closing the browser stream.
10. Extract new durable memories and update the style profile after the exchange.
11. Reload the thread from database truth.

Do not reintroduce an environment switch for streaming, AI actions, or full-text search.

The July 25 investigation found that web search was gated by a keyword regex that missed most real current-info questions (for example "what is X"), and separately that Groq's `llama-3.3-70b-versatile` sometimes emits tool calls as malformed inline text that its own API rejects. Both were fixed and confirmed via production logs: `web_search` is now a model-callable tool run on every message, and malformed tool-call output is parsed and recovered instead of discarded.

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

1. Smoke-test premium chat rendering, direct list deletion, and explicit memory recall on the real account — not yet independently confirmed since the July 24 adaptive-AI merge.
2. The Groq malformed-tool-call recovery in `lib/groq.ts` parses one known failure shape from `llama-3.3-70b-versatile`; it is a targeted workaround, not a guaranteed fix if Groq's output format drifts further. Watch production logs for `[chat] tool call failed` entries that are not recovered.
3. Supabase `HEAD .../select=id` count queries (`projects`, `notes`, `files`, `flashcards`) were observed returning 503 in production logs during the 2026-07-25 investigation. Not yet root-caused; investigate before it affects visible dashboard counts.
4. Confirm the next scheduled lifecycle-email run creates a `weekly_digest_YYYY-MM-DD` log entry and delivers to the opted-in account.
5. Update GitHub Actions from `actions/checkout@v4` and `actions/setup-node@v4`; GitHub currently warns that their Node 20 action runtime is deprecated.
6. Address Supabase performance-advisor warnings: missing foreign-key indexes and RLS policies that call `auth.uid()` without a scalar subquery.
7. Supabase leaked-password protection is unavailable on the current plan. Email confirmation is currently disabled, so signup creates an immediate session and the Resend welcome email is the first account email.
8. Add production error tracking and product analytics before scaling paid acquisition.
9. Add automated browser regression coverage for signup, notes, upload, chat streaming, memory backfill, flashcard generation, study, billing state, and logout.

## Recent release commits

- `2b1a908` — merge `landing-page-aesthetics`: spotlight/reveal treatment for the landing page and pricing cards
- `e9fd5f5` — remove usage stat cards from Settings and use more specific icons
- `de0b2c2` — recover malformed Groq function calls instead of dropping them
- `79d56c3` — make web search a model-callable tool instead of a keyword gate
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
