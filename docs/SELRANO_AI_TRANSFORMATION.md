# Selrano AI transformation

This branch transforms the existing Selrano application into an adaptive, chat-first AI workspace while preserving the Selrano brand and the working account, database, billing, file, note, and study infrastructure.

## Product changes

- Chat is the primary signed-in destination.
- Claude Sonnet 4.6 is the primary AI model.
- Groq remains the automatic fallback.
- Tavily provides current web sources through a `web_search` tool the model calls when it judges a question needs them (see `docs/HANDOFF.md` for the July 25 reliability fixes).
- Style learning and durable content memory are stored separately.
- Users can edit a message and regenerate an assistant response.
- Local autocorrect improves common typing mistakes before submission.
- Em dashes are removed from user input, stored context, and AI output.

## New environment variables

```txt
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
TAVILY_API_KEY=
```

`GROQ_API_KEY` and `GROQ_MODEL` remain required for fallback coverage.

## Database

The additive migration is:

```txt
supabase/migrations/20260724000000_selrano_personalization.sql
```

It creates `style_profiles` and `content_memories` with row-level security. Review production migration history before applying it. The app degrades safely when these tables have not been created yet.

## Brand continuity

The product name, `selrano.com` host, and Selrano email addresses remain unchanged.

## Release checks

```txt
npx tsc --noEmit --incremental false
npm run lint
npm audit --omit=dev --audit-level=high
npm run build
```
