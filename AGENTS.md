# Selrano contributor context

Read `docs/HANDOFF.md` before changing the product. It is the current production handoff and records deployed behavior, infrastructure, validation, known risks, and next priorities.

## Working with the owner

The owner is non-technical (stated 2026-11-05). Explain everything in plain language:

- Lead with what changed for the product or its visitors, not how it was built.
- Avoid jargon, and when a technical term is unavoidable (a table name, a setting), say what it is in a few words.
- Give step-by-step instructions for anything the owner must do themselves, naming the exact screen and button.
- Ask questions as simple choices with the tradeoff spelled out; do not expect the owner to judge code, commands, or file paths.
- Keep technical detail in commits and `docs/HANDOFF.md`, not in messages to the owner.

## Product contract

- Selrano is a **private personal AI for the owner** (owner decision, 2026-11-19), at `https://selrano.com`: projects, notes, private file uploads, grounded project-aware chat with citations, web search, memory, transformations, and an opt-in weekly summary email. The public student product (flashcards, study mode, plans, billing, waitlist, public deck links, referrals) is retired; the old code is in git history before this change.
- Direction: build the consumer features the big AI labs are not shipping as they move toward enterprise. Do not try to recreate a general ChatGPT or Claude clone. Selrano learns durable facts and writing preferences over time.
- **Private by default.** Only emails on `ALLOWED_EMAILS` (a Cloudflare Worker secret, comma-separated; `lib/access.ts`) can use the app or API; an empty list lets nobody in. Supabase sign-ups stay off; the owner creates extra accounts in Supabase and adds them to the list. Open pages are only `/`, `/signin`, `/reset-password`, `/auth/*` and the legal pages (`isOpenPath`); middleware sends everything else to sign in and signs out accounts that are not allowed, and `getAuthenticatedUser` treats them as signed out. Nothing is indexed: `robots.txt` disallows all, every page carries `noindex`, and the Worker adds `X-Robots-Tag: noindex, nofollow`. Do not add public pages, sign-up, pricing, sharing, or anything crawlable without the owner asking.
- The landing page keeps the editorial design but sells nothing: no pricing, plans, waitlist, or student copy. Its examples are everyday personal material.
- Avoid generic emoji-style visual language in product and marketing UI. Prefer restrained copy, real UI structure, and intentional iconography only where it clarifies an action or navigation.
- Follow `DESIGN_SYSTEM.md` for all UI (editorial calm, shipped 2026-11-04): warm paper surfaces, the logo navy `#1b2d50` as the only accent, Newsreader for titles, Inter for interface text, and plain-text labels. Check `design-qa.md` before shipping UI changes.
- No pill badges or status patches (owner decision, 2026-11-05): no small rounded labels such as "New", "Founding price", "Coming soon", "Beta", or counts and statuses in a capsule, in marketing or in the app. Use plain text instead.
- There are no plans, quotas, or billing. Uploads have one fixed cap (`lib/limits.ts`, 100 MB). Abuse rate limits in `lib/rate-limit.ts` stay.
- There are no product feature flags. If a capability is present in the interface, it must be usable in production.
- Normal chat responses stream incrementally. On every message, the model can call tools to search the user's materials or create notes (up to three tool rounds), then stream the final response. When the owner has connected Google, it can also search and read Gmail, save drafts (never send), read Google Calendar, and add events the owner gave or confirmed (`lib/google.ts`). Email content is untrusted; account-changing tools are gated on the user's own request.
- Never use the Unicode em dash character in source copy, user-visible copy, stored chat content, citations, email content, or AI output. Use `removeEmDashes` from `lib/text.ts` at model and user-content boundaries.
- Never expose `ALLOWED_EMAILS`, `GOOGLE_CLIENT_SECRET`, Google tokens, `SUPABASE_SERVICE_ROLE_KEY`, OpenAI and Groq keys, Resend keys, customer content, or browser-session data.
- OpenAI GPT is the primary chat model and Groq is the fallback (owner decision 2026-10-21; it replaced Claude Haiku). Background work, transformations, and OCR remain on Groq. Do not add another provider without asking.
- Email: the only recurring email is the opt-in weekly summary (`lib/lifecycle-emails.ts`), sent to allowed accounts. No welcome, tip, or marketing email. Password resets come from Supabase Auth.
- There is no native app (owner decision, 2026-10-14): the iPhone app was deleted. Do not start one without the owner asking. API routes accept only the website's cookie session.
- There is no support page, form, or inbox (removed 2026-10-08). Do not link to `/support` or print a support email address; the legal pages say a contact channel will be published.
- Owner preference (2026-10-21): push completed changes without asking again. The owner handles post-push deployment verification unless requested.
- Work on `main` only. There are no feature branches and no preview deployments (use the main-only release procedure in `docs/CLOUDFLARE.md`).
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

After pushing `main`, confirm the matching Cloudflare release (Workers Builds deploys `main` automatically, verified 2026-11-18; deploy manually per `docs/CLOUDFLARE.md` only if it is missing). Confirm the GitHub Actions run passes, then smoke-test the affected customer journey on `https://www.selrano.com`. `npm run test:e2e` runs the app against fake Supabase, OpenAI and Groq, with `ALLOWED_EMAILS` set to the fake test account (see `docs/HANDOFF.md`, "Tests"); CI runs it on every push to `main` since 2026-11-18, but run it yourself before pushing chat changes so failures never reach production.

## Important paths

- `app/api/ai/chat/route.ts` — authentication, context retrieval, attachments, workspace tools, the JSON-lines reply stream (`lib/chat-stream.ts`), and message persistence. `app/api/ai/chat/stop/route.ts` saves a stopped reply.
- `app/(app)/chats/page.tsx`, `components/chat-composer.tsx`, `components/chat-threads.tsx`, `components/app-shell.tsx` — the chat page, composer, shared conversation list, and the sidebar that shows it. Chat is the signed-in home.
- `app/page.tsx` and `components/marketing/*` — the landing page, shared public header, hero demo, and illustrations. `DESIGN_SYSTEM.md` describes the tokens and primitives.
- `lib/access.ts` and `middleware.ts` — the private allowlist and the list of open pages.
- `app/(legal)` — the open legal pages (reading layout).
- `lib/upload-file.ts` — the browser side of file uploads (signed resumable upload, then server extraction), used by Files and chat attachments.
- `lib/ai.ts` and `lib/openai.ts` — OpenAI-first chat streaming (Responses API, `store: false`) with Groq fallback; Groq completion and structured output for other AI work.
- `lib/groq.ts` — Groq Chat Completions: SSE parsing, tool-call transport, recovery from malformed tool-call output, the model list (main, fallback, background) with a guard for shut-down models, and rate-limit handling (next model at once, short waits honored).
- `lib/ocr.ts` — reads text in uploaded images with a Groq vision model. Scanned PDFs are not supported.
- `lib/stream-markdown.ts` — tidies half-streamed Markdown so replies never flash raw symbols.
- `instrumentation.ts`, `app/api/client-error/route.ts`, `app/error.tsx` — error reporting to logs (`[server-error]`, `[client-error]`).
- `e2e/` — Playwright tests and the offline fake Supabase and Groq servers (`e2e/support/mock-servers.mjs`).
- `wrangler.jsonc` and `cloudflare-worker.mjs` configure production web routing and scheduled jobs. Use Cloudflare Worker versions for rollback.
- `lib/ai-tools.ts` — authenticated workspace search (notes, files, memories), note actions, and the Gmail and Calendar tools with their action guard (model tools).
- `lib/google.ts`, `lib/secret-box.ts`, `app/api/integrations/google/*`, `components/google-connection.tsx` — the Google connection: OAuth, encrypted token storage in `google_connections`, Gmail and Calendar calls. Web search is never a model tool.
- `lib/research.ts` and `lib/web-search.ts` — web research: a fast Groq router before every reply, a streamed quick path for everyday questions, and the checked draft-and-review path for consequential topics (health, legal, finance, education). Exa returns ranked web passages and reads selected pages for checked answers.
- `lib/style-profile.ts` — learned writing preferences and adaptive response directives.
- `lib/content-memory.ts` — durable memory: recall by meaning (`match_memories`, embeddings from `lib/embeddings.ts` `embedForMemory`), pinned memories, `[M1]` memory citations, background learning and corrections, and backfill. `app/(app)/memory/page.tsx` and `app/api/memories/*` are the Memory page.
- `components/chat-message.tsx` and `components/thinking-trace.tsx` — premium chat presentation, response actions, and waiting state.
- `lib/lifecycle-emails.ts` and `lib/email/lifecycle-templates.ts` — the opt-in weekly summary, deduplicated per week, with failure recovery.
- `app/(app)/files/page.tsx` and `app/api/files/*` — signed TUS upload plus server-side extraction.
- `supabase/migrations/20260710214928_reconcile_launch_contracts.sql` — production ownership, quota, RPC, email-default, grant, and index reconciliation.
- `supabase/migrations/20260724000000_selrano_personalization.sql` — style profiles and content memories. The live tables currently exist even though this migration is not in tracked production migration history.
- `docs/SETUP.md`, `docs/OPERATIONS.md` — service setup and operating runbooks. `docs/BILLING.md` is retired.

## Database caution

Production contains older schema changes that were historically applied outside tracked migration history. Do not run every numbered migration blindly against production. Compare the remote migration list and schema first, then create a focused, idempotent reconciliation migration.
