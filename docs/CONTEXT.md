# Selrano project context

Read this first if you are an engineer or AI agent picking up this codebase without prior chat history.

## What Selrano is now

Selrano is an AI client workspace for independent consultants and solo service professionals.

The product is intentionally individual-first: no teams, seats, org management, admin roles, or enterprise workflows. The core user is a solo consultant/freelancer juggling client files, meeting notes, feedback, drafts, and AI chats across too many tools.

**Tagline:** An AI client workspace for independent consultants.

**Core promise:** One calm workspace for every client project.

## Current positioning

Selrano helps solo consultants:

1. Create one workspace per client, retainer, or project.
2. Upload briefs, transcripts, PDFs, research, and source docs.
3. Keep meeting notes, strategy notes, feedback, and decisions in markdown.
4. Chat with AI using the selected client workspace context.
5. Generate and review brief cards for facts, risks, decisions, action items, and open questions.

## Voice feature status

Voice work exists in the repo but is vaulted for later. Do not position the product around voice, lectures, students, or study unless explicitly asked. Keep the existing voice UI/code available as future optional work, but do not link to it from the main product narrative.

## What it is not

- Not a student study app.
- Not a team SaaS product.
- Not enterprise knowledge management.
- Not a law-firm AI visibility pivot.

## Plans and limits

Defined in `lib/plans.ts`, enforced in `lib/tier.ts` and API routes.

| | Free | Pro ($19/mo) |
|--|------|--------------|
| AI messages/day | 20 | 500 |
| Client workspaces | 3 | Unlimited |
| File upload size | 20 MB | 100 MB |
| Brief decks | 5 | Unlimited |
| Semantic search | Yes | Yes |

Billing uses Stripe checkout, portal, and webhook under `app/api/billing/`. If Stripe env vars are missing, Settings and Pricing link to `/pro/waitlist`.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 App Router, React 19, TypeScript |
| Styling | Tailwind CSS, design tokens in `app/globals.css` |
| Auth + DB | Supabase Postgres, RLS, Auth, Storage |
| AI chat | Groq (`lib/groq.ts`) |
| Embeddings / RAG | OpenAI-compatible API, pgvector |
| Email | Resend |
| Payments | Stripe |
| Hosting | Vercel |

## Repository map

```txt
app/
  page.tsx                    # Landing page
  (auth)/                     # signin, signup, reset-password
  (app)/                      # Authenticated workspace
    dashboard/ chats/ projects/ files/ notes/ flashcards/ study/ settings/ help/
  (legal)/                    # pricing, terms, privacy, security, support
  pro/waitlist/               # Pro waitlist page
  api/                        # Route handlers

components/
  app-shell.tsx
  launch/*                    # Landing page sections
  pricing-table.tsx
  pro-waitlist-form.tsx
  support-contact-form.tsx

lib/
  brand.ts plans.ts tier.ts billing.ts stripe.ts
  groq.ts embeddings.ts retrieve-context.ts ai-usage.ts
  email/
  supabase/

supabase/migrations/
docs/
```

## Naming note

The database and routes still use historical names such as `projects`, `flashcards`, `/projects`, `/flashcards`, and `/study`. User-facing copy now presents these as client workspaces, briefs, and review. Avoid risky database/route renames unless explicitly planned as a migration.

## Key design decisions

- Keep the current calm UI, colors, spacing, glass panels, and launch-page visual language.
- Keep the product individual-only.
- Preserve client-aware chat and RAG behavior as the primary differentiator.
- Keep voice work vaulted, not deleted.
- Prefer small focused diffs and avoid broad rewrites.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run setup:check
```
