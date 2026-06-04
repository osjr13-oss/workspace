# Selrano Design System

A warm, glass-morphic design language built for focus and productivity. Translucent surfaces, soft shadows, and tight typography create a premium feel that keeps users engaged without distraction.

---

## Core Principles

- **Warm neutrals over cold grays** — the palette leans warm (cream/parchment base), never sterile
- **Glass over solid** — surfaces are translucent with backdrop blur, layering depth naturally
- **Tight type** — extra-bold weights, negative letter-spacing, compact leading
- **Subtle motion** — short transitions (160–180ms ease), only on transform/opacity/border
- **Rounded everything** — pill buttons, 18px card radius, 2xl nav items; hard corners are rare

---

## Color Tokens

Paste these CSS variables into any project's `:root` to get the full palette.

```css
:root {
  /* Backgrounds */
  --background:          #f7f5f0;          /* warm parchment — page base */
  --background-elevated: #fffefa;          /* near-white — modals, cards on dark bg */

  /* Surfaces (translucent) */
  --surface:        rgba(255, 255, 255, 0.72);   /* default glass panel */
  --surface-strong: rgba(255, 255, 255, 0.92);   /* active/selected state */
  --surface-hover:  rgba(255, 255, 255, 0.86);   /* hover state */
  --surface-subtle: rgba(21, 24, 31, 0.035);     /* very light tint, zebra rows */

  /* Borders */
  --border:        rgba(31, 35, 44, 0.10);  /* default dividers */
  --border-strong: rgba(31, 35, 44, 0.18);  /* active/focus borders */

  /* Text */
  --text:         #15181f;  /* primary — near-black with warmth */
  --muted:        #69707d;  /* secondary labels, placeholders */
  --muted-strong: #3a404b;  /* body copy, descriptions */

  /* Semantic */
  --critical: #c2413d;  /* errors, destructive */
  --high:     #b85f1f;  /* warnings */
  --medium:   #9a6b13;  /* caution */
  --low:      #1f7a53;  /* success */
  --info:     #246f9f;  /* informational */
  --focus:    #15181f;  /* focus ring base */

  /* Shadows */
  --shadow-soft:  0 18px 60px rgba(38, 35, 28, 0.08);  /* panels, modals */
  --shadow-tight: 0 8px  24px rgba(38, 35, 28, 0.08);  /* cards, buttons */
}
```

### Color Usage Guide

| Token | Use it for |
|---|---|
| `--background` | `<body>` background only |
| `--background-elevated` | Content sitting above the page bg (tooltips, popovers) |
| `--surface` | Every card, panel, sidebar |
| `--surface-strong` | Active nav item, selected card |
| `--surface-subtle` | Hover rows, zebra stripes, subtle fills |
| `--border` | Dividers, card outlines |
| `--border-strong` | Active input, focused card |
| `--text` | Headings, labels, any primary text |
| `--muted` | Timestamps, meta, secondary labels |
| `--muted-strong` | Body copy, descriptions |

---

## Typography

**Font family:** [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans)
Fallback stack: `"Inter", "Segoe UI", system-ui, sans-serif`

```css
body {
  font-family: "Plus Jakarta Sans", "Inter", "Segoe UI", system-ui, sans-serif;
}
```

### Type Scale

| Role | Size | Weight | Tracking | Usage |
|---|---|---|---|---|
| Display | `4.5rem / 5rem / 7rem` | `800` | `-0.035em` | Landing hero |
| Page title | `1.875rem` | `800` | `-0.03em` | Section headers |
| Card title | `1rem` | `800` | `-0.01em` | Panel headings |
| Nav label | `0.875rem` | `700` | default | Sidebar links |
| Body | `0.875rem` | `400` | default | Descriptions |
| Meta / caption | `0.75rem` | `700` | default | Timestamps, pills |
| Table header | `0.625rem` | `800` | `0.08em` + uppercase | Column headers |

**Key rule:** headings use `font-extrabold` (800) + negative tracking (`tracking-[-0.035em]`). This is what makes the type feel premium.

### Prose Styles

```css
.prose-Selrano {
  color: var(--muted-strong);
  font-size: 14px;
  line-height: 1.7;
}
.prose-Selrano h1, h2, h3 { color: var(--text); font-weight: 800; }
.prose-Selrano code {
  border-radius: 8px;
  background: var(--surface-subtle);
  padding: 2px 6px;
  color: var(--text);
}
.prose-Selrano pre {
  border-radius: 14px;
  background: #15181f;
  padding: 16px;
  color: #fffefa;
}
```

---

## Elevation & Surfaces

The design uses three levels of elevation, all achieved with glass + shadow, not solid fills.

### `.panel` — primary container

```css
.panel {
  background: var(--surface);               /* rgba white, 72% */
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(22px) saturate(1.15);
  -webkit-backdrop-filter: blur(22px) saturate(1.15);
}
```
Use for: main content areas, sidebars, dialogs.

### `.glass-card` — interactive card

```css
.glass-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(22px) saturate(1.15);
  transition: transform 180ms ease, border-color 180ms ease,
              box-shadow 180ms ease, background 180ms ease;
}
.glass-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  background: var(--surface-hover);
}
```
Use for: clickable cards, feature tiles, project cards.

### `.stat-card` — compact metric tile

```css
.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 18px 20px;
  box-shadow: var(--shadow-tight);
}
```
Use for: dashboard stats, count tiles.

---

## Buttons

All buttons share a base of pill shape (`border-radius: 999px`), min-height 44px, bold weight, and a subtle lift on hover.

```css
.btn-primary,
.btn-secondary,
.btn-invert {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 999px;
  padding: 0 18px;
  font-weight: 700;
  transition: transform 160ms ease, box-shadow 160ms ease,
              background 160ms ease, border-color 160ms ease;
}

/* Dark — primary action */
.btn-primary {
  background: #15181f;
  color: #fffefa;
  border: 1px solid #15181f;
  box-shadow: 0 10px 28px rgba(21, 24, 31, 0.16);
}

/* Light glass — secondary/ghost action */
.btn-secondary {
  background: rgba(255, 255, 255, 0.72);
  color: var(--text);
  border: 1px solid var(--border);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.8) inset;
}

/* White on dark — use on dark/hero backgrounds */
.btn-invert {
  background: #fffefa;
  color: #15181f;
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.18);
}

.btn-primary:hover,
.btn-secondary:hover,
.btn-invert:hover {
  transform: translateY(-1px);
}
```

---

## Form Inputs

```css
.input-premium {
  min-height: 48px;
  border-radius: 999px;         /* pill shape */
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.82);
  color: var(--text);
  outline: none;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.9) inset;
  transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

.input-premium:focus {
  border-color: rgba(21, 24, 31, 0.44);
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(21, 24, 31, 0.08);
}
```

For **textarea / multi-line**, swap `border-radius: 999px` for `border-radius: 18px`.

---

## Status Pill / Badge

```css
.status-pill {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  gap: 7px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.78);
  padding: 0 10px;
  color: var(--muted-strong);
  font-size: 12px;
  font-weight: 700;
}
```
Use for: tags, labels, mobile nav items, loading indicators.

---

## Focus & Accessibility

```css
/* Applied to buttons + inputs on keyboard focus */
.btn-primary:focus-visible,
.btn-secondary:focus-visible,
.btn-invert:focus-visible,
.input-premium:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px rgba(21, 24, 31, 0.08), var(--shadow-tight);
}

/* Text selection */
::selection {
  background: rgba(21, 24, 31, 0.12);
}

/* Respect reduced-motion preferences */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## Layout

### App shell grid

```css
.layout-grid {
  display: grid;
  grid-template-columns: 272px minmax(0, 1fr);
  min-height: 100vh;
}

@media (max-width: 920px) {
  .layout-grid {
    grid-template-columns: 1fr;  /* sidebar hidden on mobile */
  }
}
```

### Sidebar

- Width: `272px`
- Background: `rgba(255, 255, 255, 0.42)` + `backdrop-blur-xl`
- Right border: `1px solid var(--border)`
- Padding: `20px horizontal, 24px vertical`
- Sticky, full viewport height

### Nav items

```
Active:   border + bg-surface-strong + shadow-tight + text-primary
Default:  text-muted, hover → bg-surface-subtle + text-primary
Shape:    rounded-2xl (16px), min-height 48px, gap-3, bold
```

### Data table

```css
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }

.data-table th {
  position: sticky; top: 0;
  background: rgba(255, 255, 255, 0.84);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
  padding: 13px 16px;
  font-size: 10px; font-weight: 800;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--muted);
}

.data-table td {
  border-bottom: 1px solid var(--border);
  padding: 15px 16px;
}
```

---

## Motion

Keep animations short and purposeful.

| Property | Duration | Easing |
|---|---|---|
| Hover lift (cards, buttons) | `160–180ms` | `ease` |
| Border/background color | `160ms` | `ease` |
| Page transitions | avoid — use instant |  |

**The one hover rule:** interactive surfaces lift `translateY(-1px)` or `translateY(-2px)` on hover. Never use scale. Never use opacity fades for hover.

---

## Iconography

Library: [Lucide React](https://lucide.dev/)
Default size: `18–19px` in nav, `16px` in body, `14–15px` in tight UI.
Stroke width: default (1.5px). Never fill icons.

---

## Applying to a New Project

1. Copy the `:root` token block into your global CSS
2. Add `Plus Jakarta Sans` via Google Fonts or `next/font`
3. Copy the component classes (`.panel`, `.btn-*`, `.input-premium`, etc.) into your global CSS
4. Set `body { background: var(--background); color: var(--text); font-family: ... }`
5. Use Tailwind for spacing/layout, reference tokens with `var(--token-name)` for color

That's the full system. Everything else — spacing, layout, page structure — uses standard Tailwind utility classes.
