# Selrano AI transformation

> Status note (2026-11-05): this was written for the July 24 transformation and is history. Since 2026-10-21, **OpenAI GPT is the primary chat model and Groq is the fallback**; Groq also runs background work, flashcards, transformations, and OCR. Anthropic is not used. Current behavior is described in `docs/HANDOFF.md`.

This branch transforms the existing Selrano application into an adaptive, chat-first AI workspace while preserving the Selrano brand and the working account, database, billing, file, note, and study infrastructure.

## Product changes

- Chat is the primary signed-in destination.
- Groq is the AI provider. (Originally Claude Sonnet 4.6 was primary with Groq as fallback; if the main Groq model is rate limited, a second Groq model now answers.)
- Tavily provides current web sources through a `web_search` tool the model calls when it judges a question needs them (see `docs/HANDOFF.md` for the July 25 reliability fixes).
- Style learning and durable content memory are stored separately.
- Users can edit a message and regenerate an assistant response.
- Local autocorrect improves common typing mistakes before submission.
- Em dashes are removed from user input, stored context, and AI output.

## New environment variables

```txt
GROQ_API_KEY=
TAVILY_API_KEY=
```

`GROQ_API_KEY` is required. The Groq model variables are optional; see `docs/SETUP.md`.

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
