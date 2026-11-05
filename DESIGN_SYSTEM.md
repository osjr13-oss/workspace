# Selrano Design System

Editorial calm: warm paper, ink, and a highlighter. Selrano should feel like a well-made notebook that happens to be very smart. Shipped November 4, 2026; updated November 5, 2026. Check changes with `design-qa.md`.

## Principles

- **Paper, not glass.** Surfaces are solid warm paper with a hairline border and a soft drop. No backdrop blur on cards; blur is only for sticky headers and overlays.
- **One accent.** The logo's navy (`#1b2d50`) is the only brand color. Use it for primary actions, active navigation, citation markers, and links. Do not add a second accent.
- **The highlighter means "from your source".** `--highlight` marks cited passages and source text. Do not use it for decoration.
- **Serif for titles, sans for everything else.** Newsreader carries page titles and marketing headlines; Inter carries the interface.
- **Calm weights.** UI headings are 600. Display titles are 500. Nothing is 800.
- **Light only.** Selrano has one light theme. There is no dark mode; do not add dark-only colors.
- **Sentence case.** Labels and eyebrows are sentence case. No uppercase tracking labels.
- **No pill badges.** Never put a label, status, count, or tag in a small rounded capsule ("New", "Founding price", "Coming soon", "3 sources ready", "0 notes"). Write it as plain text. Owner decision, November 5, 2026.
- **Real UI over decoration.** Marketing illustrations are built from real product parts (bubbles, citations, file rows). No emoji, no stock icons as decoration, no fake customer logos.

## Fonts

Loaded with `next/font/google` in `app/layout.tsx` (self-hosted at build, no runtime request to Google):

| Variable | Family | Use |
|---|---|---|
| `--font-sans` | Inter (variable) | All interface and body text. Tailwind `font-sans`. |
| `--font-display` | Newsreader (variable, optical size) | Page titles, marketing headlines, big numbers. Tailwind `font-display`, or the `.title-display` class. |

## Tokens (`app/globals.css`)

| Token | Value | Use |
|---|---|---|
| `--background` | `#f6f3ec` | Page base |
| `--background-elevated` | `#fdfbf7` | Wells and secondary panes inside a surface |
| `--surface` / `--surface-strong` | `#fffdf9` / `#ffffff` | Cards and panels / inputs and raised items |
| `--surface-sunken` | `#efebe2` | App sidebar, backdrops behind illustrations |
| `--surface-subtle` | warm 4.5% tint | Hover rows |
| `--border` / `--border-strong` | warm 11% / 20% | Hairlines / inputs and emphasis |
| `--text` / `--muted-strong` / `--muted` | `#16191f` / `#3b4048` / `#676b72` | Headings / body / meta. Muted passes AA on paper. |
| `--accent` / `--accent-hover` | `#1b2d50` / `#26396a` | Primary actions, active state, links |
| `--accent-soft` / `--accent-soft-strong` / `--accent-ring` | navy at 7% / 12% / 22% | User bubble, citation fill, focus rings |
| `--on-accent` | `#fdfbf7` | Text on the accent |
| `--highlight` / `--highlight-strong` | `#f4e4b0` / `#ecd48a` | Cited passages, blockquote rule, text selection |
| `--shadow-tight` / `--shadow-soft` / `--shadow-lift` | | Small items / panels / hero product shots |

Status colors (`--critical`, `--high`, `--medium`, `--low`, `--info`) are for state only.

## Type helpers

- `.title-display`: serif, weight 500, tight tracking. Size it with Tailwind (`text-[40px]` and up for page titles).
- `.eyebrow`: 13px, weight 500, muted, sentence case. Add `.eyebrow-accent` for marketing section labels.
- `.prose-selrano`: reading pages (legal, guides). Serif headings, 16px body, ink links.
- `.answer-prose`: assistant replies in chat.

## Primitives

| Class | What it is |
|---|---|
| `.panel` | Primary container: surface, hairline, `--shadow-soft`, 16px radius |
| `.glass-card` | Interactive card (name kept for compatibility; it is solid now) |
| `.well` | Recessed group inside a panel |
| `.stat-card` | Small metric tile |
| `.btn-primary` | Ink rounded button. One per view where possible. |
| `.btn-secondary` | Paper rounded button with a strong hairline |
| `.btn-ghost` | Text button with hover fill |
| `.btn-invert` | Paper rounded button for use on ink bands |
| `.btn-sm` | Smaller size modifier for any button |
| `.input-premium` | 12px radius field; ink border and soft ring on focus |
| `.composer`, `.send-button`, `.user-bubble`, `.starter-card` | Chat parts, reused by the landing illustrations |
| `.focus-ring` | Adds the standard focus ring to any element |

Focus is always visible: a 3px paper gap plus a 2px accent ring (`--accent-ring`).

## Components

- `components/marketing/site-header.tsx`: public header with a mobile disclosure menu (Escape closes it and returns focus).
- `components/site-footer.tsx`: public footer with Product, Learn, Legal, Account columns.
- `components/marketing/hero-demo.tsx`: the looping product demo. Pauses offscreen and in hidden tabs; shows the final frame under reduced motion.
- `components/marketing/vignettes.tsx`: small static product pictures used on the landing page and the auth panel.
- `components/marketing/waitlist-form.tsx`: email capture that posts to `/api/waitlist`. Light and dark tones.
- `components/marketing/page-intro.tsx`: title block for marketing pages.
- `components/auth-frame.tsx`: shared layout and field for sign in, sign up, and password pages.
- `components/workspace-header.tsx` and `components/empty-state.tsx`: app page title and empty states (optional icon).
- `components/citation-badge.tsx`: numbered ink marker that opens the cited passage.

## Layout

- Marketing content width is `max-w-6xl` with `px-5 sm:px-8`. Reading pages are `max-w-[44rem]`.
- `app/(marketing)` (pricing, guides, changelog, shared decks) uses a wide layout; `app/(legal)` uses the reading layout. Both use the shared header and footer.
- The app frame is a sunken sidebar (268px, collapsible to 64px) beside the page. Below `lg` it becomes a drawer with a slim top bar.
- Every page must work at 390px wide with no horizontal scroll. Form rows use `flex-wrap` with `min-w-[11rem]` fields so they wrap instead of crushing.

## Motion

- Transitions are 140 to 200ms on color, border, and shadow. Buttons do not jump on hover.
- `components/reveal.tsx` fades sections in on scroll (once). Keep offsets small.
- Respect `prefers-reduced-motion`; the global rule in `globals.css` shortens animations, and the hero demo stops on its final frame.

## Iconography

Lucide icons at 15 to 20px, stroke 2. Use an icon only when it names an action, a section, or a file type. Icons inside the accent color mark the important thing in a group, not every item.
