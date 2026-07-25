# Selrano contributor context

Read `docs/HANDOFF.md` before changing the product. It is the current production handoff and records deployed behavior, infrastructure, validation, known risks, and next priorities.

## Product contract

- Selrano is a production AI workspace at `https://selrano.com` for projects, notes, private file uploads, project-aware chat, flashcards, study review, support, and Stripe billing.
- Selrano is also an adaptive personal AI. It learns durable facts and writing preferences over time while keeping the Selrano brand across the product, domain, and email.
- Position Selrano as a calm materials workspace: source files, notes, grounded chat, review, and transformations together. Do not make the product revolve entirely around flashcards or frame it as a Quizlet competitor; flashcards are one useful output inside the broader workspace.
- Avoid generic emoji-style visual language in product and marketing UI. Prefer restrained copy, real UI structure, and intentional iconography only where it clarifies an action or navigation.
- Do not market exact AI message allowances on public pricing or acquisition pages. Authenticated billing may show a user's current usage and plan limit for transparency.
- There are no product feature flags. If a capability is present in the interface or changelog, it must be usable in production.
- Normal chat responses stream incrementally. Explicit workspace requests can search the user's materials, create notes, and create flashcard decks, then stream the final response.
- Never use the Unicode em dash character in source copy, user-visible copy, stored chat content, citations, email content, or AI output. Use `removeEmDashes` from `lib/text.ts` at model and user-content boundaries.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, Stripe secrets, Groq keys, Resend keys, customer content, or browser-session data.
- Preserve user changes in the working tree and never delete production/test data without explicit approval.

## Before a release

Run:

```bash
npm run typecheck
npm run lint
npm audit --omit=dev --audit-level=high
npm run build
rg -n '\x{2014}' app components lib
git diff --check
```

Pushes to `main` deploy production. Confirm the GitHub Actions run passes, then smoke-test the affected customer journey on `https://www.selrano.com`.

## Important paths

- `app/api/ai/chat/route.ts` — authentication, quota reservation, context retrieval, workspace tools, streaming, and message persistence.
- `lib/ai.ts` — Anthropic-first completion and streaming with Groq fallback before any token has been emitted.
- `lib/groq.ts` — Groq Chat Completions, SSE parsing, and tool-call transport.
- `lib/ai-tools.ts` — authenticated workspace search/note/deck actions.
- `lib/style-profile.ts` — learned writing preferences and adaptive response directives.
- `lib/content-memory.ts` — durable fact extraction, historical backfill, explicit recall, and relevance ranking.
- `components/chat-message.tsx` and `components/thinking-trace.tsx` — premium chat presentation, response actions, and waiting state.
- `lib/lifecycle-emails.ts` and `lib/email/lifecycle-templates.ts` — opted-in tips, weekly workspace check-ins, deduplication, and failure recovery.
- `app/(app)/files/page.tsx` and `app/api/files/*` — signed TUS upload plus server-side extraction.
- `supabase/migrations/20260710214928_reconcile_launch_contracts.sql` — production ownership, quota, RPC, email-default, grant, and index reconciliation.
- `supabase/migrations/20260724000000_selrano_personalization.sql` — style profiles and content memories. The live tables currently exist even though this migration is not in tracked production migration history.
- `docs/SETUP.md`, `docs/OPERATIONS.md`, `docs/BILLING.md` — service setup and operating runbooks.

## Database caution

Production contains older schema changes that were historically applied outside tracked migration history. Do not run every numbered migration blindly against production. Compare the remote migration list and schema first, then create a focused, idempotent reconciliation migration.
