# Selrano contributor context

Read `docs/HANDOFF.md` before changing the product. It is the current production handoff and records deployed behavior, infrastructure, validation, known risks, and next priorities.

## Current product direction (September 8, 2026)

Selrano's development direction is now a versioned AI thinking partner for exploring ideas and making decisions. The user moved away from security because they do not want to promise security accuracy as a solo, nontechnical founder. Do not continue expanding scanner features, monitoring, or the conversation-import/extension concepts without a new request.

- Active development branch: `codex/selrano-1-prototype`, checkout `/Users/osmanosman/workspace-prototype`. Read `docs/PROTOTYPE.md` for implementation and validation.
- `main` and https://www.selrano.com still serve the security scanner. Leave production, billing, and customer data alone. The user authorized pushing the prototype branch, not merging or promoting it.
- Selrano 1 is an AI system using Groq's `openai/gpt-oss-120b`; it is not a foundation model trained by Selrano. Current system release: `selrano-1.0.1`. Version behavior, settings, and release notes together; retain attribution on saved responses.
- The user likes its speed, intelligence, and conversational tone. Preserve those strengths. They strongly disliked the prototype's visual design. The design is NOT approved and needs substantial improvement in a future iteration; no replacement visual direction has been selected yet. Preserve the Selrano brand and aim for a calm, polished experience without treating the current layout as the design target.
- Product behavior: take initiative when the user is unsure; offer concrete options; ask at most one focused question when useful; remember accepted/rejected options within the current chat; disagree respectfully; distinguish suggestions from user decisions.
- Privacy is a primary constraint. No extension, chat imports, connected accounts, automatic capture, cross-chat memory, analytics, or training collection. Browser-local history only; only the active conversation is sent to Groq. Do not reactivate legacy personalization or workspace tools.
- The prototype is local-only at http://127.0.0.1:3210. Hosted previews deliberately return 403. Do not remove localhost/origin guards to make a Vercel preview work without explicit authorization for a hosted product and appropriate access controls.
- Twenty fictional A/B comparisons exist; the user's positive initial feedback is not a scored 15/20 evaluation result. Real-use trials and formal preference ratings remain pending.
- Future ambitions include progressively stronger releases and eventually fine-tuning an appropriately licensed existing model. Training, public launch, subscriptions, and model selection are deferred.

## Production security scanner (maintenance context)

The September 6 scanner remains deployed while Selrano 1 is evaluated privately. Read `docs/SECURITY_MIGRATION.md` only when maintaining that production journey. Preserve existing authentication, billing, data, and the no-em-dash rule. Scanner routes are `/dashboard`, `/scans`, `/scans/[scanId]`, and `/copilot`.

## Historical workspace contract (retained infrastructure, not prototype requirements)

- Selrano is a production AI workspace at `https://selrano.com` for projects, notes, private file uploads, project-aware chat, flashcards, study review, support, and Stripe billing.
- Selrano is also an adaptive personal AI. It learns durable facts and writing preferences over time while keeping the Selrano brand across the product, domain, and email.
- Position Selrano as a calm materials workspace: source files, notes, grounded chat, review, and transformations together. Do not make the product revolve entirely around flashcards or frame it as a Quizlet competitor; flashcards are one useful output inside the broader workspace.
- Avoid generic emoji-style visual language in product and marketing UI. Prefer restrained copy, real UI structure, and intentional iconography only where it clarifies an action or navigation.
- Do not market exact AI message allowances on public pricing or acquisition pages. Authenticated billing may show a user's current usage and plan limit for transparency.
- There are no product feature flags. If a capability is present in the interface or changelog, it must be usable in production.
- Normal chat responses stream incrementally. On every message, the model can call tools to search the user's materials, search the live web, create notes, or create flashcard decks, then stream the final response.
- Never use the Unicode em dash character in source copy, user-visible copy, stored chat content, citations, email content, or AI output. Use `removeEmDashes` from `lib/text.ts` at model and user-content boundaries.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, Stripe secrets, Groq keys, Resend keys, customer content, or browser-session data.
- Preserve user changes in the working tree and never delete production/test data without explicit approval.

## Before a release

For prototype work, also run `npm test` and verify the local chat journey. Push only the prototype branch when requested. Historical production requirements below do not authorize a production release.

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
- `lib/groq.ts` — Groq Chat Completions, SSE parsing, tool-call transport, and recovery from malformed tool-call output.
- `lib/ai-tools.ts` — authenticated workspace search/note/deck actions plus the `web_search` tool (backed by `lib/web-search.ts`).
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
