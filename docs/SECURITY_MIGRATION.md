# Selrano security transformation

Status: release authorized September 6; focused production migration applied and verified, application deployment in progress.

## Product and import scope

The primary journey is now website URL -> passive scan -> prioritized findings -> fix prompts -> report-aware AI Copilot -> manual rescan. Selrano keeps its brand, warm palette, translucent panels, typography, restrained motion, existing accounts, Stripe billing, and $6.99 founding Pro price.

Source: `https://github.com/osjr13-oss/launchguard`, commit `af3a7a6e3b354e89343e92de358de6ad59427c6f`.

Imported and adapted:

- `src/lib/scanner/{index,rules,url,types}.ts` -> `lib/security/scanner/`
- Deterministic analysis and builder prompts -> `lib/security/analysis.ts`
- Scanner tests, plus new network-safety, request-size, privacy, API, and database tests

The source app's separate workspace membership, billing, and session schemas are not installed over Selrano's existing tables. Source extras such as anonymous scans, public report sharing, automatic monitoring, and regression emails are not exposed in this integration. All marketed capabilities use real implementations. The public sample report is explicitly labeled as an HTML fixture and is never presented as a live scan.

## Routes and behavior

- `/`: security homepage using the existing design system
- `/dashboard`: new scan form and recent scan history
- `/scans`: paginated private scan history
- `/scans/[scanId]`: report, severity filters, evidence, prompts, JSON export, manual rescan, Copilot
- `/copilot`: choose a saved scan as conversation context
- `/sample-report`: interactive public illustration with real rule-generated findings
- `/guides`, `/help`, `/pricing`, signup, metadata, welcome/lifecycle templates: updated product copy
- `/settings`: existing billing/profile controls and links to previous workspace content

Previous projects, notes, uploads, chats, decks, public deck URLs, and review data are preserved. Their existing APIs remain available for account continuity. The old Quizlet acquisition guide redirects to the scan guide, and the sitemap focuses on security-product pages.

## Storage and authorization

`supabase/migrations/20260906114947_security_scanner.sql` is additive and repeatable:

- `security_scans`: owner, normalized URL, status, summary, score, report JSON, failure state, timestamps
- `security_copilot_messages`: owned per-scan user/assistant messages
- RLS and explicit grants allow authenticated owners to read only their own rows
- Browser roles cannot insert, update, or delete scanner records; server endpoints authenticate and write through the service role
- A composite foreign key enforces matching scan/message ownership
- Account deletion cascades into the new tables

A running row is saved before scanning. Completed reports are saved before returning success. Failed attempts remain in history. Requests interrupted by the hosting runtime are shown as interrupted after two minutes and can be retried; there is no background scan worker.

Existing `check_rate_limit(text,text,integer,integer)` enforces scan attempts per user. Free allows 5 attempts per 24-hour window; Pro and active referral bonuses allow 50. Failed attempts consume allowance. Copilot uses the existing transactional `reserve_ai_usage` allowance and a short-window rate limit. It fails closed if usage cannot be verified.

Copilot loads owned report data and recent stored messages on the server. It ignores client-provided report context, treats evidence as untrusted data, and uses existing Anthropic-first/Groq-fallback streaming. A 45-second provider timeout leaves time to persist partial output. Messages and model output use `removeEmDashes`. Stream errors and persistence failures are shown explicitly.

## Scanner protections and limits

The scanner checks up to ten HTML pages on the same origin, with bounded responses and request timeouts. Each target and redirect is checked against public address ranges; connection-time DNS lookup guards against DNS rebinding. IPv4-mapped IPv6 and special transition ranges are blocked. Only standard HTTP/HTTPS ports are accepted. Credentials are rejected, and query strings/fragments are removed.

Detected secret values are redacted from evidence. Cookie values are used only to check attributes and are not saved; stored response headers use an allowlist. Failures in DNS/file/certificate checks are reported as unavailable rather than claimed as confirmed missing. Page counts represent pages successfully read, not merely queued links. Non-HTML or non-successful entry responses fail the scan rather than creating misleading reports.

This is a passive public-surface check, not a penetration test. It does not execute JavaScript, inspect repository code, submit forms, access authenticated routes, or validate database permissions. DNS email checks are scoped to the scanned hostname (with `www` removed), not a full organizational-domain or inherited-policy audit. Trust/readiness findings are distinct from confirmed exploitable vulnerabilities.

## Verification

Completed locally on September 6:

- `npm run typecheck`
- `npm run lint`
- `npm test`: 66 passing tests; the opt-in network test is skipped by default
- `SELRANO_SCAN_SMOKE_URL=https://www.selrano.com npm test -- lib/security/scanner/live.test.ts`: live scan passed
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilities
- `npm run build`: passed
- em-dash scan and `git diff --check`: passed
- Browser: homepage and sample report render without runtime errors at desktop and 390px mobile width, with no horizontal overflow. Findings, fix-prompt and coverage tabs work. Copy prompt confirms success. Export downloads valid JSON containing findings and fix prompts. Signed-out `/scans` access redirects to sign-in.

Storage tests execute the migration twice in isolated PGlite PostgreSQL, then exercise owner reads, cross-owner denial, anonymous denial, client-write denial, composite ownership enforcement, and account-deletion cascades. Route tests mock infrastructure/providers and verify authorization, quotas, persistence ordering, failure records, sanitized streaming, and partial-response saving. These tests do not substitute for an authenticated production smoke test.

Patched vulnerable dependencies within compatible version ranges; imported `undici` is pinned to 7.29.1. CI now includes the scanner/storage/API test suite.

## Production cutover

Read-only remote inspection on September 6 confirmed neither new table exists in Supabase project `ucuppqutbzbwekyxrkwr`. Both required quota/rate-limit RPC signatures exist. Remote migration history includes August migrations that are absent from the older production handoff. Do not apply all local migration files.

1. Recheck remote schema and migration history immediately before release.
2. The focused security-scanner migration has now been applied. For a future environment, apply only this migration after reviewing any intervening schema changes. It does not rename or remove existing tables.
3. Verify owner RLS, service-role grants, and the new tables through the API, then run Supabase advisors.
4. Re-run the repository release checks. Push to `main` only when the production cutover is intended, because that deploys the site.
5. Confirm GitHub Actions and Vercel deployment success.
6. With an authenticated account, scan an authorized public URL, reload the saved report, copy a prompt, export a report, send a Copilot question, reload its history, and run a second scan. Confirm unauthorized scan IDs do not reveal reports/messages.
7. Verify mobile navigation, billing, logout, and access to previous workspace data. Check lifecycle job delivery on its normal schedule; no manual customer emails have been sent.
8. Add the security launch to the public changelog only after the database and production journey are live.

The existing environment already has an AI provider configured. No new provider credentials are required. The focused migration was applied as `20260906114947_security_scanner` on September 6 before the production push. RLS, owner-read policies, client write denial, anonymous read denial, and service-role writes were verified. Existing customer data was not modified. No manual customer emails were sent.

Supabase security advisors report no issues on the new tables. Existing notices remain for the vector extension schema, authenticated quota/study RPCs, and leaked-password protection; see the prior operating handoff.
