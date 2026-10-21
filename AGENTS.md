# Selrano contributor context

Read `docs/HANDOFF.md` before changing the product. It is the current production handoff and records deployed behavior, infrastructure, validation, known risks, and next priorities.

## Product contract

- Selrano is a private, ultra-low-friction personal health, diet and weight-loss app at `https://selrano.com` (owner decision, 2026-10-21; it replaced the study workspace, archived at tag `archive-workspace-v2`). It is built first for the owner's daily use on phone and computer, but nothing owner-specific belongs in code: targets, units and timezone come from each user's profile so a public rollout stays easy.
- The product is: a health profile with safe targets, quick food logging (AI estimates from text or a photo with an editable confirm card, food database search, barcode lookup, recents and favorites), weight logging with a smoothed trend, an AI coach chat that knows the user's data, push reminders, and Apple Health data from the iPhone companion app. The phased plan lives in `docs/HANDOFF.md`, "Health pivot".
- Safety is deterministic and lives in code, not prompts: calorie floors, deficit and pace caps, maintain-only for under-18s and pregnancy, and a gentle mode that never pushes restriction. The coach is not a doctor and must not present itself as one.
- Avoid generic emoji-style visual language in product and marketing UI. Prefer restrained copy, real UI structure, and intentional iconography only where it clarifies an action or navigation.
- Do not market exact AI message allowances on public pricing or acquisition pages. Stripe billing code stays in place but pricing and upgrade UI are hidden while Selrano is private.
- There are no product feature flags. If a capability is present in the interface, it must be usable in production.
- Normal chat responses stream incrementally. The model can call tools, then stream the final response.
- Never use the Unicode em dash character in source copy, user-visible copy, stored chat content, citations, email content, or AI output. Use `removeEmDashes` from `lib/text.ts` at model and user-content boundaries.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, Stripe secrets, AI provider keys, Resend keys, device tokens, customer content (including health data), or browser-session data.
- AI providers (owner decision, 2026-10-21): OpenAI GPT models are primary for chat, meal estimates and food-photo reading, with Groq as the fallback. Background work (memory extraction) stays on Groq. Claude is no longer used. Do not add another provider without asking. Food databases (USDA FoodData Central, Open Food Facts) are data sources, not AI providers.
- Selrano is private (owner decision, 2026-10-13): only `ALLOWED_EMAILS` accounts get in, and nothing is offered to search engines. Keep new pages and API routes behind `lib/access.ts` (middleware plus `getAuthenticatedUser`). See `docs/HANDOFF.md`, "Private access".
- Native app (owner decision, 2026-10-21, reversing 2026-10-14): `ios/SelranoHealth` is a SwiftUI companion whose only job is syncing Apple Health (steps, active energy, exercise, workouts, sleep, resting heart rate) to Selrano. Website API routes accept only the cookie session, with one scoped exception: `/api/health/*` device routes accept a hashed, revocable device token issued through a pairing code. Do not add general bearer-token auth.
- There is no support page, form, or inbox (removed 2026-10-08). Do not link to `/support` or print a support email address; the legal pages say a contact channel will be published.
- Owner preference (2026-10-21): push completed changes without asking again. The owner handles post-push deployment verification unless requested.
- Work on `main` only. There are no feature branches and no preview deployments (`vercel.json` deploys only `main`).
- Chat requests must stay small: Groq limits tokens per minute per model. Keep prompts, history, and tool descriptions lean, and keep model work that is not the answer (memory extraction) off the critical path.
- Preserve user changes in the working tree and never delete production/test data without explicit approval. Old workspace tables (projects, notes, files, flashcards) stay in the database untouched.

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

Pushes to `main` deploy production. Confirm the GitHub Actions run passes, then smoke-test the affected customer journey on `https://www.selrano.com`. `npm run test:e2e` runs the app against fake Supabase and AI providers (see `docs/HANDOFF.md`, "Tests"); CI does not run it yet, so run it yourself before pushing chat changes.

## Important paths

- `app/api/ai/chat/route.ts`: authentication, quota reservation, research routing, tools, the JSON-lines reply stream (`lib/chat-stream.ts`), and message persistence. `app/api/ai/chat/stop/route.ts` saves a stopped reply.
- `lib/coach-prompt.ts`: the coach's standing instructions.
- `app/(app)/chats/page.tsx`, `components/chat-composer.tsx`, `components/chat-threads.tsx`, `components/app-shell.tsx`: the coach chat page, composer, shared conversation list, and the sidebar.
- `lib/ai.ts`: provider selection and fallback for streaming and structured output. `lib/groq.ts`: Groq Chat Completions: SSE parsing, tool-call transport, malformed tool-call recovery, the model list with a guard for shut-down models, and rate-limit handling.
- `lib/research.ts`: bounded web research; `isOrdinaryHealthTurn` skips it for logging and coaching turns.
- `lib/stream-markdown.ts`: tidies half-streamed Markdown so replies never flash raw symbols.
- `instrumentation.ts`, `app/api/client-error/route.ts`, `app/error.tsx`: error reporting to logs (`[server-error]`, `[client-error]`).
- `e2e/`: Playwright tests and the offline fake Supabase and AI servers (`e2e/support/mock-servers.mjs`).
- `ios/`: the SelranoHealth companion app (XcodeGen `project.yml`; see `ios/README.md`).
- `vercel.json`: cron schedule and the rule that only `main` deploys.
- `lib/ai-tools.ts`: tools the chat model can call.
- `lib/style-profile.ts` and `lib/content-memory.ts`: learned writing preferences and durable personal facts (never daily log entries).
- `components/chat-message.tsx` and `components/thinking-trace.tsx`: chat presentation, response actions, and waiting state.
- `lib/lifecycle-emails.ts` and `lib/email/lifecycle-templates.ts`: opted-in check-in emails, deduplication, and failure recovery.
- `docs/SETUP.md`, `docs/OPERATIONS.md`, `docs/BILLING.md`: service setup and operating runbooks.

## Database caution

Production contains older schema changes that were historically applied outside tracked migration history. Do not run every numbered migration blindly against production. Compare the remote migration list and schema first, then create a focused, idempotent reconciliation migration.
