# Selrano contributor context

Read `docs/HANDOFF.md` before changing the product. It is the current production handoff and records deployed behavior, infrastructure, validation, known risks, and next priorities.

## Product contract

- Selrano is a production AI workspace at `https://selrano.com` for projects, notes, private file uploads, project-aware chat, flashcards, study review, support, and Stripe billing.
- Position Selrano for professional certification and licensure exam prep (bar exam, CFA, medical/nursing boards, PMP, and similar), not general college students or a broad "AI workspace" pitch. Lead with grounded chat: answers traced to the user's own uploaded outlines and practice material, since accuracy matters more when a wrong answer affects a license or certification. Source files are the trust foundation; spaced repetition review is the expected companion (this audience already uses tools like Anki); notes and transformations support the work but do not lead the pitch.
- Avoid generic emoji-style visual language in product and marketing UI. Prefer restrained copy, real UI structure, and intentional iconography only where it clarifies an action or navigation.
- There are no product feature flags. If a capability is present in the interface or changelog, it must be usable in production.
- Normal chat responses stream incrementally. Explicit workspace requests can search the user's materials, create notes, and create flashcard decks, then stream the final response.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, Stripe secrets, Groq keys, Resend keys, customer content, or browser-session data.
- Preserve user changes in the working tree and never delete production/test data without explicit approval.

## Before a release

Run:

```bash
npm run typecheck
npm run lint
npm audit --omit=dev --audit-level=high
npm run build
```

Pushes to `main` deploy production. Confirm the GitHub Actions run passes, then smoke-test the affected customer journey on `https://www.selrano.com`.

## Important paths

- `app/api/ai/chat/route.ts` — authentication, quota reservation, context retrieval, workspace tools, streaming, and message persistence.
- `lib/groq.ts` — Groq Chat Completions, SSE parsing, and tool-call transport.
- `lib/ai-tools.ts` — authenticated workspace search/note/deck actions.
- `app/(app)/files/page.tsx` and `app/api/files/*` — signed TUS upload plus server-side extraction.
- `supabase/migrations/20260710214928_reconcile_launch_contracts.sql` — production ownership, quota, RPC, email-default, grant, and index reconciliation.
- `docs/SETUP.md`, `docs/OPERATIONS.md`, `docs/BILLING.md` — service setup and operating runbooks.

## Database caution

Production contains older schema changes that were historically applied outside tracked migration history. Do not run every numbered migration blindly against production. Compare the remote migration list and schema first, then create a focused, idempotent reconciliation migration.
