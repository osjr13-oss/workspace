# Selrano contributor context

Read docs/HANDOFF.md and docs/PROTOTYPE.md before changes.

## Current product

Selrano 1 is a public AI thinking partner for exploring ideas and making decisions, powered by Groq openai/gpt-oss-120b. It is a versioned AI system, not a foundation model trained from scratch. Current release: selrano-1.0.1.

Production development is now on main in /Users/osmanosman/workspace. The prototype checkout remains available on codex/selrano-1-prototype. Public Vercel previews are explicitly authorized. Do not add private-access or localhost-only restrictions. The user authorized replacing production with Selrano 1 on main. Do not change billing or customer data without a separate request.

The user likes speed, intelligence, and tone, but strongly dislikes the current visual design. No replacement design has been selected. Build around conversation, meaningful releases, initiative, respectful disagreement, and retaining decisions within a chat. Ask one focused question when needed.

Chats currently persist in browser storage, with only the active chat sent to Groq. Account storage and cross-device sync are not implemented; this is an implementation limit, not a permanent product prohibition. No model training collection or cross-chat memory is currently implemented. Keep provider credentials server-side and never expose customer data or secrets.

Current implementation: components/prototype/chat.tsx, lib/prototype/, app/api/prototype/chat/route.ts. Legacy modules are inactive and must not define the product direction. Earlier product documentation is available in git history.

Never use Unicode em dashes in product copy or model output; use removeEmDashes from lib/text.ts.

## Verification

Run npm test, npm run typecheck, npm run lint, npm audit --omit=dev --audit-level=high, npm run build, and git diff --check. Verify the hosted page and streaming chat after pushing the prototype branch. Preserve user changes.
