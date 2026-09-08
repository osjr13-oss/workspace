# Selrano 1 public prototype

This checkout is an unreleased experiment on `codex/selrano-1-prototype`. Production deployment on main is authorized. Existing production data and billing are untouched.

## Latest user feedback and direction

The user has tried Selrano 1 and likes its speed, intelligence, and tone. They strongly disliked the design. Treat the current interface as a functional prototype, not an approved aesthetic; improve it in a separately scoped iteration while preserving conversational quality. No replacement design has been chosen.

This is the active product direction. The user authorized the move to main. The prototype branch has been pushed to GitHub; the user subsequently authorized production deployment on main. Public hosted preview access is explicitly authorized. Initial praise is qualitative feedback, not a completed A/B score.

## Run

From this checkout, run `npm run prototype` and open http://127.0.0.1:3210. Use that same address consistently: localhost and 127.0.0.1 have separate browser storage. The ignored `.env.local` needs only `GROQ_API_KEY`. The model is pinned in the release definition. This checkout currently reuses the original checkout's node_modules through a symlink; run npm ci if moving it to another machine.

The server binds to 127.0.0.1. Middleware allows public hosted access while rejecting non-prototype application routes. The chat endpoint additionally requires a matching Origin and JSON content type. The original database credentials were not copied here.

## Behavior and privacy

Start a chat, select an example, or use Where we are for a recap. Enter sends; Shift+Enter adds a line. Stop preserves partial output as incomplete; Retry replaces that unfinished response. Reload restores browser-local chats. Deletion asks for confirmation and affects only the local copy.

Only the active chat plus release instructions goes to Groq. There is no server-side chat persistence, telemetry, personalization, memory extraction, training collection, web browsing, or workspace-tool execution in this flow. Generated images and links do not trigger external requests. Groq still processes requests under its own policies. Local storage is not encrypted and can be read by someone with access to the browser profile.

User messages are limited to 8,000 characters; conversation context is limited to 60,000 characters and 200 messages. Oversized requests fail explicitly; history is never silently truncated. Only one generation runs at a time per local process. Requests time out after 45 seconds and incomplete outputs remain marked as such. Storage problems are visible and corrupt saved data is not overwritten.

## Releases

`lib/prototype/release.ts` defines Selrano 1 (`selrano-1.0.1`), Groq's `openai/gpt-oss-120b`, generation settings, system instructions, and release notes. Responses carry the server-issued release ID into local storage. Bump the release ID for later behavior changes and keep evaluation results tied to that ID. This is a versioned AI system using an existing model, not a newly trained model.

## Evaluation

20 fictional scenarios are in `scripts/prototype/scenarios.json`. Run `node --env-file=.env.local scripts/prototype/evaluate.mjs` with a Node version supporting TypeScript type stripping (the current environment uses Node 26). The script uses the same model and settings for Selrano and a generic baseline, resumes completed pairs, and backs off on rate limits. Results stay in ignored `.prototype-evaluation/`.

Read `.prototype-evaluation/comparison.md` and mark A, B, or Tie before looking at the variant key in results.json. Judge helpfulness, initiative, constraint retention, honesty, and unnecessary questions. The user preference target is 15 of 20 pairs. It is pending the user's ratings, not an established benchmark or quality claim.

Try several real conversations before considering a public transition. Fine-tuning, subscriptions, model selection, and replacing the production site are deferred. Public branch previews are authorized.

## Validation completed September 8

Typecheck, lint, build, and 87 unit/integration tests passed; one unrelated opt-in scanner network test remains skipped. Production dependency audit reports zero vulnerabilities. Browser verification covered live streaming, a recap, persistence after reload, recovery from a simulated connection failure, release attribution, confirmed test-chat deletion across reload, and no horizontal overflow at 390px. Browser network observations showed only local requests. Twenty complete baseline/Selrano pairs were generated for release 1.0.1; user preferences and several real-life trial conversations remain pending.

The early 1.0.0 run exhausted its response budget in one scenario. Release 1.0.1 explicitly selects low reasoning effort and increases the completion budget to 4,096 tokens for both the prototype and comparison baseline. Earlier settings are retained in RELEASES. Parameter support was checked against https://console.groq.com/docs/api-reference.
