# Selrano production handoff

Last updated: **October 14, 2026**

## Claude-first chat (October 14)

The owner approved Claude Haiku as the primary chat model, with Groq as fallback, and asked for better answers and a less distant conversational voice. This supersedes the earlier Groq-only decision for chat. The implementation has passed typecheck, lint, production audit, build, and all 34 enabled offline browser tests (three credential-dependent tests skipped). Commit `f6dc2e3` deployed successfully and GitHub CI passed. The live chat replied, but a direct synthetic API check found the owner's key is not workspace-scoped: Anthropic returns 400 without `anthropic-workspace-id`, so chat is currently falling back to Groq. The workspace-header fix has passed all required checks, including all 34 enabled browser tests. A direct real-provider check returned 200 from `claude-haiku-5-5`, and the actual SSE adapter produced a coherent prose answer. The owner has added `ANTHROPIC_WORKSPACE_ID` in Vercel Production; the follow-up release and live-site confirmation remain.

- `lib/anthropic.ts` uses the Messages API with `claude-haiku-5-5` by default (`ANTHROPIC_MODEL` overrides it), incremental SSE text, workspace/web tools, and signed thinking preserved only for tool continuations. Thinking is never shown or stored in chat history.
- `ANTHROPIC_API_KEY` is a server-only secret. The owner reports it has been added in Production and locally. `ANTHROPIC_WORKSPACE_ID` is required for a key that is not scoped to a workspace. Without a working Claude configuration, chat continues on Groq. `ANTHROPIC_BASE_URL` exists only for offline tests and must not be set in Vercel.
- Claude errors, empty replies, or a 25-second wait for first output fall back to Groq before text starts. Once text starts, a failure saves the partial reply instead of splicing in another provider's answer. Continuations keep their starting provider, with Groq fallback still available if Claude cannot begin the continuation.
- Background memory extraction, structured flashcards, transformations, and image OCR remain on Groq.
- Chat instructions emphasize substance, conversation continuity, candid judgment, warm natural prose, and formatting only when useful. Short user messages no longer teach the style profile to give shallow replies or imitate lowercase typing.
- The offline rig includes Claude scenarios for primary streaming, hidden thinking, signed tool continuation, pre-output fallback, partial failure, and persistence. Existing Groq scenarios default Claude to unavailable to retain fallback coverage.
- Legal provider disclosures now include Anthropic. No database migration or UI layout change.
- Release verification: release the tested workspace-header fix and confirm a real Claude response on the live site. The workspace ID is configured locally and the owner reports it is saved in Vercel Production. Automated stand-ins verify transport, not answer quality; the owner should compare the conversational voice on real questions.

## Current state

- Production: `https://selrano.com` (redirects to `https://www.selrano.com`)
- Repository: `osjr13-oss/workspace`. Only `main` exists on GitHub. Work is committed straight to `main`; there are no feature branches and no preview deployments (see "Hosting and deploys").
- Production branch: `main`
- Supabase project ref: `ucuppqutbzbwekyxrkwr`
- AI providers: **Claude Haiku primary chat, Groq fallback** (owner approved 2026-10-14). `ANTHROPIC_MODEL` defaults to `claude-haiku-5-5`. Groq defaults remain `openai/gpt-oss-120b` and `openai/gpt-oss-20b`, with background work, structured flashcards, transformations, and OCR still on Groq. See "Claude-first chat" and "Groq models".
- Billing: Stripe Free + Pro at founding/introductory **$6.99/month** (see `lib/plans.ts` `priceKind: "founding"`)
- Email: Resend for application mail; Supabase Auth for confirmation/reset mail
- Access: **private**. Only emails in `ALLOWED_EMAILS` can sign in; the landing page, pricing, guides, signup, and shared decks send visitors to sign in, and search engines are turned away. See "Private access".
- Support: there is **no support page, form, or inbox** (removed 2026-10-08). See "Support and contact".
- Product feature flags: **none**. Shipped capabilities are always enabled.
- Obsolete Vercel feature environment variables and `FLAGS_SECRET` were removed on July 11.
- Latest product change: Claude-first chat and conversational instructions. Earlier today: the iPhone app's removal (2026-10-14, see "iPhone app (deleted)"). On 2026-10-14 the owner moved local work to a Windows Dell laptop (cloned from GitHub main).
- The code is the **August 13 baseline** (`36354bf`) plus the changes listed under "Changes since the August 13 baseline". The September work (security scanner pivot, "Lumen 1" prototype, mobile app) is **not** in `main`; it is preserved as tags (see "History and recovery").

## History and recovery

- 2026-09-25: commit `32f773d` ("Shut down Selrano v1 and reset repository to zero") deleted the whole application and committed `node_modules`.
- 2026-09-29: `main` was restored to the August 13 state (`36354bf`) in commit `cc4140a`. The tag **`v-august-stable`** marks that known-good point; `git checkout v-august-stable` returns to it.
- Work from the other branches is preserved as tags, which never trigger deployments. Do not delete them:
  - `archive-selrano-v1` (`b6d6fc6`): the Lumen 1 thinking-partner prototype, the Selrano mobile app, and the roadmap.
  - `archive-cursor-groq-chat` (`96b6c6e`): the tip of the deleted `cursor/groq-chat-9090` branch (commit message "Build the Groq chat product"). Its contents were not reviewed; it is kept only so nothing is lost.
- 2026-10-08: the leftover remote branches (`archive/selrano-v1`, `codex/selrano-1-prototype`, `cursor/groq-chat-9090`) were deleted after the tags above were pushed.

## Changes since the August 13 baseline

- **Security:** `npm audit fix` patched the critical and high advisories (Next.js, sharp, `@xmldom/xmldom`, qs). Three moderate advisories remain (`mammoth` through `argparse` to `sprintf-js`); the only fix is a forced downgrade of `mammoth`, so they are accepted for now. CI's `--audit-level=high` passes.
- **Support removed (2026-10-08):** see "Support and contact".
- **Image uploads:** PNG, JPG, WebP, and GIF files are read by a Groq vision model (`lib/ocr.ts`, up to about 2.8 MB each). Scanned PDFs are **not** supported: Groq cannot read PDFs directly, and a PDF with no text layer is rejected with a clear message. See `app/api/files/upload/route.ts`.
- **Error reporting:** `instrumentation.ts` logs failed server requests as one `[server-error]` JSON line; `/api/client-error` receives browser crashes (rate limited) and logs `[client-error]`; `app/error.tsx` and `app/global-error.tsx` show a friendly page instead of a blank one. Search these tags in Vercel logs. There is no alerting.
- **AI:** Groq-only, with a streaming, rate-limit-aware request path. See "AI request lifecycle". Chat time to first word, the "no responses after a few messages" failures, and the flashing reply were all fixed on 2026-10-08.
- **Chat page:** compact orbiting-ring waiting indicator; only one reply can be in flight (Enter is ignored while busy); half-streamed Markdown is tidied; the streamed bubble hands over to the saved message without remounting.
- **Tailwind config:** `tailwind.config.ts` imports `@tailwindcss/typography` instead of calling `require`, because newer Node versions load TypeScript configs natively and `require` crashed the dev server.
- **Tooling:** Playwright tests with offline stand-ins for Supabase and Groq. See "Tests".
- **Hosting:** only `main` deploys. See "Hosting and deploys".
- **Private access (2026-10-13):** see "Private access".
- **Chat redesign (2026-10-13):** see "Chat experience".

## Chat experience

Rebuilt on 2026-10-13. Chat is the signed-in home: `/`, sign-in, the auth callback, password update, and the installed app all land on `/chats`.

- **One sidebar** (`components/app-shell.tsx`): New chat, the workspace sections, and recent chats grouped by day, with search, inline delete, and a collapse toggle. On phones it is a drawer behind the menu button. The chat page no longer has its own thread list.
- **Conversation**: a centered reading column. The header shows the chat's title with Rename and Delete. A new chat offers four starter prompts.
- **Composer**: grows with the text; attach up to four files; pick a project for a new chat (an existing chat keeps its project); the send button turns into **Stop** while a reply runs (Esc also stops). `/` focuses the box.
- **Stop** keeps the words already shown. The page calls `POST /api/ai/chat/stop`, which saves them as the reply; the generating request keeps running, sees that newer message when it finishes, and saves nothing on top. A reply stopped before any words is saved empty and shows "Stopped before replying." with a regenerate button; empty replies are left out of the model's history.
- **Tool status**: while a tool runs the page shows what Selrano is doing (for example `Searching the web for "..."`) until the first words arrive.
- **Attachments** upload into the workspace like the Files page (`lib/upload-file.ts`, in the chat's project). The chat request sends `fileIds`; their text (6,000 characters in total) goes into the prompt, and a reference to each file is saved in the user message's `citations` (marker `attachment-N`), so the message shows them after a reload. No schema change.
- **Answers**: code blocks with a copy button and highlighting (`highlight.js`, loaded only when code appears), scrolling tables, and a Sources row for web citations.
- **Smooth streaming**: Groq sends text in bursts of a few hundred characters. `lib/stream-pacer.ts` reveals it a few characters per frame instead, never slower than about 60 characters a second and never more than about 0.4 seconds behind what has arrived. Stop saves exactly what was revealed.
- **Scrolling** follows new words only while you are at the bottom; scrolling up shows a jump-to-latest button.

## iPhone app (deleted)

The owner stopped the iPhone app on 2026-10-14 and asked for it to be deleted: there is no more work on it. It never ran on a simulator or a device (installing Expo Go into the iOS 27 simulator on the owner's Mac hung).

- Removed: `mobile/`, the API's `Authorization: Bearer` sign-in path in `getAuthenticatedUser`, `/api/me`, their test, and the `mobile/` exclusions in TypeScript, ESLint, and `.vercelignore`. API routes again accept only the website's cookie session.
- Kept, because the website benefits: the Markdown tidier hides a table until its divider row is complete, and the streaming pacer uses plain `setTimeout`.
- The code remains in history at `cce338d` only for reference. Do not restart a native app without the owner asking.

## Groq models

- Checked against Groq's deprecation page on 2026-10-08: `llama-3.3-70b-versatile` and `llama-3.1-8b-instant` (shut down 2026-08-16), `meta-llama/llama-4-scout-17b-16e-instruct` and `qwen/qwen3-32b` (2026-07-17), and `qwen/qwen3.6-27b` (2026-09-14) no longer work for non-enterprise accounts. `SHUT_DOWN_MODELS` in `lib/groq.ts` makes a stale environment value fall back to the default instead of failing. Add to that list when Groq announces more: https://console.groq.com/docs/deprecations
- `qwen/qwen3.8-27b` (vision) is listed as a preview model and may change. `openai/gpt-oss-120b` and `openai/gpt-oss-20b` are listed as production models.
- Groq enforces request and token limits **per model**. That is why the fallback and background models differ from the main one, why prompts are kept small, and why a rate-limited main model hands over to the fallback at once.
- Chat answers on gpt-oss models are sent `reasoning_effort: "medium"` (owner decision, 2026-10-13, for smarter answers; set `GROQ_REASONING_EFFORT` to `low` or `high` to change it) with room for 4,096 completion tokens, since hidden reasoning counts toward that limit. Background work (memory extraction, structured output) stays at `low`. Reasoning is never shown (`include_reasoning: false`). gpt-oss models do not support parallel tool calls.
- Model decision (owner, 2026-10-14): **Claude Haiku primary, Groq fallback**, now approved. Gemini models remain ruled out. Do not add another provider without the owner asking.
- `GROQ_BASE_URL` overrides the API address. It exists for the offline tests; do not set it in Vercel.

## Hosting and deploys

- Vercel project `workspace`, deployed from `main`.
- `vercel.json` sets `git.deploymentEnabled` to `{"**": false, "main": true}` so only `main` builds. A push to `main` deploying to production was confirmed; the "other branches are skipped" half was not tested on purpose, to avoid creating a preview.
- Vercel does not create a **production** deployment for a commit SHA it has already built as a preview. With no previews every push to `main` builds as production; if one is ever missing, push a new commit.
- Check a deploy with the GitHub commit status named "Vercel" or `gh api repos/osjr13-oss/workspace/deployments`, then open the live site.
- CI (GitHub Actions, Node 20) runs typecheck, lint, the production dependency audit at `high`, and build. It does **not** run the Playwright tests. The development machine used Node 26, so keep both in mind.

## Private access

The owner decided on 2026-10-13 to keep Selrano private while the product is reworked.

- `lib/access.ts` reads `ALLOWED_EMAILS` (comma-separated, case-insensitive). Empty or missing lets **nobody** in. The owner set it in Vercel Production and turned off Supabase signups on 2026-10-13.
- `middleware.ts`: a session for an account that is not on the list is signed out and sent to `/signin?private=1`. Without an allowed account, only `/signin`, `/reset-password`, `/auth/*`, `/privacy`, `/terms`, `/security`, and `/robots.txt` open; everything else, including `/`, redirects to sign in. A signed-in visit to `/` goes to the app.
- `getAuthenticatedUser` (`lib/supabase/server.ts`) treats a non-allowed account as signed out, so every API route refuses it with 401. Stripe and cron webhooks do not use it and are unaffected.
- `robots.txt` disallows everything and every page carries `noindex`. The sign-in page has no "Create account" link.
- **Limit:** pages read and write Supabase directly from the browser under row-level security. Someone who creates an account through the Supabase Auth API could still store rows in their own empty workspace (never anyone else's). To close that, turn off **Allow new users to sign up** in Supabase Dashboard > Authentication > Sign In / Providers. Re-enable it before reopening.
- **Reopening:** drop the allowlist check in `middleware.ts` and `getAuthenticatedUser`, restore `app/robots.ts` and the `robots` metadata in `app/layout.tsx`, put the "Create account" link back on the sign-in page, and restore the public-page tests in `e2e/public.spec.ts` (all in the commit that introduced `lib/access.ts`).

## Support and contact

- Removed on 2026-10-08: `/support`, `/help`, the support contact form, `/api/support/contact`, the support email in footers and email footers, the Settings "Help & support" panel, and the welcome email's "reply to us" line. `SUPPORT_INBOX` and `NEXT_PUBLIC_SUPPORT_EMAIL` are no longer read and can be deleted from Vercel.
- Still in the database: the `support_requests` table and its history. Migrations were left unchanged.
- The Privacy, Terms, and Security pages state that Selrano does not currently offer a public email address and that a contact channel will be published. A privacy policy normally needs a contact method: when one exists, update `app/(legal)/privacy/page.tsx`, `terms/page.tsx`, and `security/page.tsx`, and reword the "Respond to your support requests" line in the Privacy page's data-use list.
- Check once: the Supabase Auth email templates (pasted into the Supabase dashboard from `docs/OPERATIONS.md`) used to link to `/support`, which is now a 404. Make sure the live templates no longer contain that link.

## Product positioning and UI direction

- Position Selrano as a calm AI workspace for a user's own materials: projects, notes, private uploads, grounded chat, quick transformations, flashcards, and review.
- Do not let the homepage or onboarding revolve entirely around flashcards. Flashcards are useful, but Selrano should not read like a Quizlet competitor.
- The preferred public framing is materials first: gather source material, work with context, then review what matters.
- Avoid generic emoji-style decoration or low-effort visual shorthand in product and marketing UI. Use restrained text structure and intentional icons only when they clarify an action, navigation item, or status.
- Keep the Selrano name across the product, domain, and email. Do not revive the imported product's previous brand.
- Public pricing and acquisition pages should sell capability and outcomes without advertising exact AI message allowances. Authenticated billing may still show current usage and limits.
- Chat presentation should feel calm and premium: soft user prompt cards, borderless editorial assistant prose, visible response actions, and the compact orbiting-ring indicator while waiting.
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

On 2026-10-13 the owner confirmed by hand on the live site that chat is faster and more reliable after the October 8 changes, and that a web-search answer came back correct. Later that day the owner used the redesigned chat live ("it's better") and asked for smoother streaming and a smarter model; both shipped (`686a433`, `b964040`) but have not been confirmed by the owner on the live site yet. That was a manual check; the automated tests run against offline stand-ins, not production.

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
- Claude Haiku is primary for chat, with Groq fallback; other AI work remains on Groq.
- Selrano learns a style directive from conversation history and uses durable content memories when relevant.
- Established accounts with no memories can bootstrap up to 12 durable facts from as many as 80 earlier user messages. This runs **after** a reply is sent, at most once a day per account (`maybeBootstrapMemories`). It used to run in front of the answer on every message and was a major cause of slow and failing chat.
- Explicit recall prompts such as "what do you remember about me?" return the strongest stored memories without requiring lexical overlap.
- User messages use soft prompt cards; assistant responses use a readable editorial layout with copy, read-aloud, and regenerate actions.
- The waiting state is a compact orbiting ring (`components/thinking-trace.tsx`), shown only until the first words of a reply appear.
- Conversations can be deleted directly from the chat list, including on touch layouts.
- The Study navigation icon now uses a modern brain-circuit mark.
- Public pricing and guide copy no longer advertise exact AI message allowances.
- Opted-in accounts at least seven days old are eligible for a weekly workspace check-in, subject to a seven-day minimum between lifecycle emails.
- Lifecycle sends are claimed in the log before delivery to prevent duplicates. A failed send removes its claim so it can be retried.
- Every chat message is one streaming Groq request that also offers `web_search` and the workspace tools, so the model itself judges when it needs current information. There is no separate tool-decision round trip.
- Malformed Groq tool-call output (a tool call written as text and rejected by Groq as `tool_use_failed`) is parsed from the rejected error and recovered (`recoverMalformedToolCall` in `lib/groq.ts`; it handles the `<function=name {...}>` form and a JSON object with a name and arguments). The llama model that produced it is shut down, so this is now a safety net.
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

AI quota: `reserve_ai_usage` in `20260813120000_founding_pricing_limits.sql` allows Free 20 requests per UTC day and Pro or an active referral bonus 1500 per UTC month, matching `lib/plans.ts`. That migration is not in the July list above, so confirm it is applied in production. When a chat turn produces no answer, `refundAiRequest` (`lib/ai-usage.ts`, service role) deletes the newest `ai_usage_events` row for that user and route so a failure does not cost a message. Edits and regenerations still count.

The July 11 email incident was caused by production migration drift: the server role had schema access but was missing table privileges. The live grant repair fixed the Email preferences error immediately. The signed-in production check confirmed **Send tips & feature reminders** now persists successfully. `RESEND_API_KEY`, `EMAIL_FROM`, and `CRON_SECRET` are present in Vercel production/preview configuration (`SUPPORT_INBOX` is also set but no longer used). The July 10 account affected by the incident was recovered through the deployed welcome-email batch at `2026-07-11 00:31:51 UTC`; the database shows one welcome audit event, confirming one delivery without duplication.

The July 24 lifecycle investigation found that preferences were saving correctly, but active established users could age out of every narrow tip campaign. The live database had no lifecycle-email log rows for the opted-in active account. The new weekly check-in closes that eligibility gap. A real external lifecycle email was not triggered manually during local verification, so confirm the next scheduled production run and its log entry before treating delivery as fully observed.

The July 24 memory investigation found historical user messages but no content-memory rows for the established active account. The application backfills durable memories from earlier conversation history when the memory table is empty (now in the background, see above), then treats direct recall questions as a request for the strongest stored facts.

## AI request lifecycle

1. Authenticate the user (API routes skip the middleware session check, so there is one auth round trip, not two).
2. In parallel: verify thread/project ownership and reserve daily AI usage atomically.
3. In parallel: load recent history, project context, style profile, and relevant durable memories, while saving the user message. History is the last 12 messages within 8,000 characters (each clipped to 2,000); project context is capped at 9,000 characters; answers are capped at 4,096 completion tokens, which include the hidden reasoning (see "Groq models"). These limits keep every request small enough for Groq's per-model token limits.
4. Send one streaming Claude request (Groq if Claude is not configured or cannot begin output) that offers workspace search, live web search, note creation, and flashcard creation. A normal answer streams immediately; a tool call runs the tool and then streams the final answer. Attached files (`fileIds`) are added to the prompt as the user's own material.
5. The reply is a stream of JSON lines (`lib/chat-stream.ts`): `start` (the conversation id, sent at once), `status` (what a tool is doing), `text` (the next words), and `error` (nothing could be produced; the page restores the user's text). Checks that fail before generation starts (sign in, ownership, the daily limit) are still plain JSON errors. The opening words are held for a moment so a "let me look that up" lead-in before a tool call never flashes on screen.
6. Claude falls back to Groq before output, never midway through visible text. Groq limits are per model. If the main model (`GROQ_MODEL`, default `openai/gpt-oss-120b`) is rate limited or gone, `GROQ_FALLBACK_MODEL` (default `openai/gpt-oss-20b`) is tried at once; if both are limited, the shortest requested wait (up to 9 seconds) is honored once.
7. An empty reply is retried once without tools. If nothing can be produced, the just-saved user message (and a thread created by this request) is removed, the reserved usage is refunded, and the page puts the text back in the box.
8. Remove em dashes at every model-output boundary.
9. Persist the assistant response before closing the stream, unless Stop already saved a reply (the newest message in the thread is then an assistant message). Generation runs to completion even if the browser leaves.
10. After the response (`after()`): update the thread timestamp, extract new durable memories (only when the message is personal; background model `GROQ_BACKGROUND_MODEL`), and bootstrap memories from history at most once a day. None of this is ever in front of an answer.
11. The page keeps one reply in flight (Enter is ignored while busy), tidies half-streamed Markdown (`lib/stream-markdown.ts`), and hands the streamed bubble over to the saved row without remounting it. Opening another chat mid-reply stops listening (the server still saves the answer); Stop saves what was shown.

Each finished reply logs one `[chat] reply` line with time to first word, total time, length, tool count, and whether the browser left, which is the quickest way to check speed in Vercel logs.

## Tests

`npm run test:e2e` builds the app into `.next-e2e`, serves it on port 3000, and starts two offline stand-ins (`e2e/support/mock-servers.mjs`): a fake Supabase on port 54321 and a fake Groq on port 54322. No accounts or network are needed. `E2E_DEV=1` uses the dev server instead of a production build.

- `e2e/public.spec.ts`: private access. Closed marketing, signup, and shared-deck pages; open legal pages; robots and `noindex`; an allowed account getting in and a non-allowed one being refused and signed out (the fake Supabase can report another email through `GET http://localhost:54321/__user?email=...`).
- `e2e/chat.spec.ts`: streaming without flashes, unfinished Markdown, empty replies, rate limits and model fallback, memory work staying off the critical path, prompt size, tool lead-ins, leaving mid-answer, double Enter, and the daily limit. These only run against the local setup, not a deployed site.
- `e2e/chat-experience.spec.ts`: bursts are revealed smoothly (no frame jumps more than 80 characters), Stop (button and Esc) saves only what was shown, tool status, the sidebar (new chat appears, rename, reopen, delete), attachments reaching the model and showing on the message, code blocks and tables, jump to latest, and the phone menu.
- `e2e/account.spec.ts`: signed-in checks; skipped unless you set `E2E_EMAIL` and `E2E_PASSWORD` for your own test account.

On a Mac, install the browser once with `npx playwright install chromium`, then `npm run test:e2e`. If a machine's preinstalled Chromium does not match this Playwright version, point the tests at it with `PW_CHROMIUM_PATH` (in Claude Code cloud sessions: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e`).

To reproduce a chat bug before changing code, use the rig: the fake Groq can be told to fail, rate limit, return nothing, call a tool, wait before the first word (`firstTokenDelayMs`), send bursts (`chunkChars`), or stream slowly (`POST http://localhost:54322/__control`, see `e2e/support/session.ts`). The tests are not part of CI yet.

## Validation and release

```bash
npm install
npm run setup:check
npm run typecheck
npm run lint
npm audit --omit=dev --audit-level=high
npm run build
npm run test:e2e
rg -n '\x{2014}' app components lib
git diff --check
```

Push to `main`, watch GitHub Actions, allow the Vercel deployment to turn over, and verify the real production flow. A passing Next.js build or the offline tests do not validate Supabase migrations, Storage, Stripe webhooks, real Groq behavior, or Resend delivery.

## Known limitations and next priorities

1. Premium chat rendering, direct list deletion, and explicit memory recall were not independently confirmed on the real account after the July 24 merge. The owner confirmed on 2026-10-13 that chat itself works well.
2. Watch production logs for `[chat] tool-enabled stream failed` entries (a tool-enabled request that failed and was retried without tools) and for `[groq] ... unavailable` lines, which show how often the fallback model is used.
3. Supabase `HEAD .../select=id` count queries (`projects`, `notes`, `files`, `flashcards`) were observed returning 503 in production logs during the 2026-07-25 investigation. Not root-caused. The August 8 migrations (hot-path indexes, scalar-subquery RLS policies) are in the repo, but their application to production has not been verified. The owner chose not to pursue this on 2026-10-08.
4. Confirm the next scheduled lifecycle-email run creates a `weekly_digest_YYYY-MM-DD` log entry and delivers to the opted-in account.
5. Update GitHub Actions from `actions/checkout@v4` and `actions/setup-node@v4`; GitHub currently warns that their Node 20 action runtime is deprecated.
6. The Supabase performance-advisor warnings (missing foreign-key indexes, RLS policies calling `auth.uid()` without a scalar subquery) are addressed by the August 8 migrations in the repo. Confirm they are applied and re-run the advisor.
7. Supabase leaked-password protection is unavailable on the current plan. Signups are turned off while Selrano is private (see "Private access"); when they reopen, email confirmation is disabled, so signup creates an immediate session and the Resend welcome email is the first account email.
8. Monitoring is logs only: `[server-error]`, `[client-error]`, and the `[chat] reply` timing line. There is no alerting, error grouping, or product analytics beyond Vercel Web Analytics. Add them before scaling paid acquisition.
9. Browser tests cover private access and chat. Notes, the real upload path (the signed upload goes to Supabase Storage, which the fakes do not imitate), flashcard generation, study, billing, and logout are not covered, and the tests are not in CI.
10. There is no public contact channel (see "Support and contact").
11. Scanned PDFs are unsupported and images are limited to about 2.8 MB.
12. Compare the new Claude-first conversational voice on real questions with the owner (see "Claude-first chat").
13. Parked ideas (owner said "not now", 2026-10-13): when web sources disagree because something changed over time, answer with what it was before and what it is now, citing each, and pass source dates to the model (it currently sees none); a small "Searched the web" label on replies that used search; possibly raise the 20-per-day Free cap for the owner's own account.

## Recent release commits

- (2026-10-14): delete the iPhone app and the API's bearer-token sign-in
- `cce338d`: start the iPhone app (since deleted); table dividers no longer flash while streaming
- `1f4300b`: record the model direction (Haiku next, Gemini ruled out)
- `b964040`: chat answers think harder on Groq (medium reasoning by default)
- `686a433`: smooth streaming (steady reveal instead of bursts)
- `a133058`: chat redesign (one sidebar, Stop, live tool status, attachments, richer answers)
- `ce68b6f`, `9a2cc8c`: Selrano made private to an email allowlist
- `7454166`: correct the support removal date
- `473fa4a`: refresh the handoff for the Groq-only, main-only, support-free state
- `72776ef` — fix slow, failing, and flickering chat; add offline end-to-end tests
- `4d5d7a2` — only deploy `main` on Vercel
- `ad78c9a` — switch Groq defaults to models that still exist
- `63422a9` — make Groq the only AI provider and stream chat without a blocking tool pass
- `a8ec000` — Playwright tests and Tailwind config fix for newer Node
- `a45f713` — server and browser error reporting
- `faeb1c3` — read text in uploaded images (later limited to images, see "Changes since the August 13 baseline")
- `7f8406e` — remove the support page, form, API, help center, and support email
- `3dd94ef` — patch critical and high production dependency advisories
- `cc4140a` — restore the August 13 state (`36354bf`) after the repository reset
- `36354bf` — update founding Pro pricing and plan limits (the baseline)
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
