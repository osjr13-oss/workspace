# Selrano contributor context

Read `docs/HANDOFF.md` before changing the product. It is the current production handoff and records deployed behavior, infrastructure, validation, known risks, and next priorities.

## Product contract

- Selrano is a production AI workspace at `https://selrano.com` for projects, notes, private file uploads, project-aware chat, flashcards, study review, and Stripe billing.
- Selrano is also an adaptive personal AI. It learns durable facts and writing preferences over time while keeping the Selrano brand across the product, domain, and email.
- Position Selrano as a calm materials workspace: source files, notes, grounded chat, review, and transformations together. Do not make the product revolve entirely around flashcards or frame it as a Quizlet competitor; flashcards are one useful output inside the broader workspace.
- Avoid generic emoji-style visual language in product and marketing UI. Prefer restrained copy, real UI structure, and intentional iconography only where it clarifies an action or navigation.
- Do not market exact AI message allowances on public pricing or acquisition pages. Authenticated billing may show a user's current usage and plan limit for transparency.
- There are no product feature flags. If a capability is present in the interface or changelog, it must be usable in production.
- Normal chat responses stream incrementally. On every message, the model can call tools to search the user's materials, search the live web, create notes, or create flashcard decks, then stream the final response.
- Never use the Unicode em dash character in source copy, user-visible copy, stored chat content, citations, email content, or AI output. Use `removeEmDashes` from `lib/text.ts` at model and user-content boundaries.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, Stripe secrets, Groq keys, Resend keys, customer content, or browser-session data.
- Groq is the only AI provider (owner decision, 2026-10-08). Do not add Anthropic or another provider without asking.
- Selrano is private (owner decision, 2026-10-13): only `ALLOWED_EMAILS` accounts get in, and nothing is offered to search engines. Keep new pages and API routes behind `lib/access.ts` (middleware plus `getAuthenticatedUser`). See `docs/HANDOFF.md`, "Private access".
- There is no support page, form, or inbox (removed 2026-10-08). Do not link to `/support` or print a support email address; the legal pages say a contact channel will be published.
- Work on `main` only. There are no feature branches and no preview deployments (`vercel.json` deploys only `main`).
- Chat requests must stay small: Groq limits tokens per minute per model. Keep prompts, history, and tool descriptions lean, and keep model work that is not the answer (memory extraction) off the critical path.
- Preserve user changes in the working tree and never delete production/test data without explicit approval.

## Before a release

Run:

```bash
npm run typecheck
npm run lint
npm audit --omit=dev --audit-level=high
npm run build
npm run test:e2e
rg -n '\x{2014}' app components lib
git diff --check
```

Pushes to `main` deploy production. Confirm the GitHub Actions run passes, then smoke-test the affected customer journey on `https://www.selrano.com`. `npm run test:e2e` runs the app against fake Supabase and Groq (see `docs/HANDOFF.md`, "Tests"); CI does not run it yet, so run it yourself before pushing chat changes.

## Important paths

- `app/api/ai/chat/route.ts` — authentication, quota reservation, context retrieval, attachments, workspace tools, the JSON-lines reply stream (`lib/chat-stream.ts`), and message persistence. `app/api/ai/chat/stop/route.ts` saves a stopped reply.
- `app/(app)/chats/page.tsx`, `components/chat-composer.tsx`, `components/chat-threads.tsx`, `components/app-shell.tsx` — the chat page, composer, shared conversation list, and the sidebar that shows it. Chat is the signed-in home.
- `mobile/` — the iPhone app (Expo, work in progress). Read `mobile/AGENTS.md`. It shares `lib/chat-stream.ts`, `lib/stream-pacer.ts`, `lib/stream-markdown.ts`, `lib/text.ts`, and `lib/types.ts`, so keep those free of imports and browser-only APIs. API routes accept its `Authorization: Bearer` token through `getAuthenticatedUser`.
- `lib/upload-file.ts` — the browser side of file uploads (signed resumable upload, then server extraction), used by Files and chat attachments.
- `lib/ai.ts` — Groq-only completion, structured output, and streaming. Groq is the single AI provider.
- `lib/groq.ts` — Groq Chat Completions: SSE parsing, tool-call transport, recovery from malformed tool-call output, the model list (main, fallback, background) with a guard for shut-down models, and rate-limit handling (next model at once, short waits honored).
- `lib/ocr.ts` — reads text in uploaded images with a Groq vision model. Scanned PDFs are not supported.
- `lib/stream-markdown.ts` — tidies half-streamed Markdown so replies never flash raw symbols.
- `instrumentation.ts`, `app/api/client-error/route.ts`, `app/error.tsx` — error reporting to logs (`[server-error]`, `[client-error]`).
- `e2e/` — Playwright tests and the offline fake Supabase and Groq servers (`e2e/support/mock-servers.mjs`).
- `vercel.json` — cron schedule and the rule that only `main` deploys.
- `lib/ai-tools.ts` — authenticated workspace search/note/deck actions plus the `web_search` tool (backed by `lib/web-search.ts`).
- `lib/style-profile.ts` — learned writing preferences and adaptive response directives.
- `lib/content-memory.ts` — durable fact extraction, historical backfill (background, at most once a day), explicit recall, and relevance ranking.
- `components/chat-message.tsx` and `components/thinking-trace.tsx` — premium chat presentation, response actions, and waiting state.
- `lib/lifecycle-emails.ts` and `lib/email/lifecycle-templates.ts` — opted-in tips, weekly workspace check-ins, deduplication, and failure recovery.
- `app/(app)/files/page.tsx` and `app/api/files/*` — signed TUS upload plus server-side extraction.
- `supabase/migrations/20260710214928_reconcile_launch_contracts.sql` — production ownership, quota, RPC, email-default, grant, and index reconciliation.
- `supabase/migrations/20260724000000_selrano_personalization.sql` — style profiles and content memories. The live tables currently exist even though this migration is not in tracked production migration history.
- `docs/SETUP.md`, `docs/OPERATIONS.md`, `docs/BILLING.md` — service setup and operating runbooks.

## Database caution

Production contains older schema changes that were historically applied outside tracked migration history. Do not run every numbered migration blindly against production. Compare the remote migration list and schema first, then create a focused, idempotent reconciliation migration.
