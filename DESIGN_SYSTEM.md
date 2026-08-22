# Selrano Enterprise Design System

A precision, high-contrast, modern enterprise design system built for deep thinking, focus, and clarity. Inspired by the calm craft of OpenAI, Apple, Linear, and Stripe.

---

## Core Principles

- **Precision neutrals over muddy tints**: Crisp daylight canvas (`#f8fafc`), pure white elevated surfaces (`#ffffff`), and deep obsidian text (`#090d16`).
- **Hairline borders over heavy outlines**: 1px borders with subtle alpha blending (`rgba(15, 23, 42, 0.08)`).
- **Disciplined typography**: Plus Jakarta Sans with tight tracking (`-0.02em` to `-0.04em`), clean monospace code blocks, and tabular figures for metrics.
- **Micro-elevation & multi-tier shadows**: Layered diffused shadows for cards, panels, and modals (`--shadow-xs` to `--shadow-modal`).
- **Functional iconography**: Strictly Lucide icons used for clarity; zero generic emoji clutter or sparkles.
- **Zero Unicode em dashes**: Strictly enforced across all source copy, AI responses, citations, and metadata.

---

## Color Tokens

Global CSS variables in `app/globals.css`:

```css
:root {
  /* Enterprise Canvas & Surfaces */
  --background:          #f8fafc;  /* crisp daylight canvas */
  --background-elevated: #ffffff;  /* elevated card and modal surface */
  --surface:             #ffffff;  /* default panel surface */
  --surface-strong:      #f1f5f9;  /* active item background */
  --surface-hover:       #f8fafc;  /* hover background */
  --surface-subtle:      #f8fafc;  /* subtle row tint */
  --surface-inset:       #f1f5f9;  /* input and code container inset */

  /* Hairline Borders */
  --border:        rgba(15, 23, 42, 0.08);  /* standard dividers */
  --border-strong: rgba(15, 23, 42, 0.16);  /* input borders and card outlines */
  --border-focus:  rgba(15, 23, 42, 0.35);  /* focus ring boundary */

  /* Typography */
  --text:         #090d16;  /* primary obsidian text */
  --muted:        #64748b;  /* secondary labels, metadata */
  --muted-strong: #334155;  /* body text and descriptions */

  /* Semantic Accents */
  --accent:            #0f172a;  /* primary dark accent */
  --accent-foreground: #ffffff;
  --critical:          #ef4444;  /* errors and destructive actions */
  --critical-subtle:   #fef2f2;
  --critical-border:   #fecaca;
  --warning:           #f59e0b;  /* cautions and processing states */
  --warning-subtle:    #fffbeb;
  --warning-border:    #fde68a;
  --success:           #10b981;  /* durable memory and success states */
  --success-subtle:    #ecfdf5;
  --success-border:    #a7f3d0;
  --info:              #3b82f6;  /* web grounding and citations */
  --info-subtle:       #eff6ff;
  --info-border:       #bfdbfe;

  /* Multi-Tier Elevation Shadows */
  --shadow-xs:       0 1px 2px 0 rgba(15, 23, 42, 0.04);
  --shadow-tight:    0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05);
  --shadow-soft:     0 4px 16px -2px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.04);
  --shadow-elevated: 0 12px 32px -4px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.04);
  --shadow-modal:    0 24px 60px -12px rgba(15, 23, 42, 0.18), 0 8px 24px -4px rgba(15, 23, 42, 0.08);
}
```

---

## Typography

- **Primary Font**: Plus Jakarta Sans
- **Fallback**: Inter, Segoe UI, system-ui, sans-serif
- **Monospace Stack**: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace

```css
body {
  font-family: "Plus Jakarta Sans", "Inter", "Segoe UI", system-ui, sans-serif;
  font-feature-settings: "cv02", "cv03", "cv04", "cv11";
}
```

### Type Scale

| Role | Size | Weight | Tracking | Usage |
|---|---|---|---|---|
| Display / Hero | `2.5rem - 4.5rem` | `700` | `-0.035em` | Landing hero |
| Page Title | `1.5rem - 1.875rem` | `700` | `-0.025em` | Workspace headers |
| Section / Card Title | `0.875rem - 1.125rem` | `700` | `-0.015em` | Panel and card headings |
| Navigation Item | `0.875rem` | `600` | `-0.01em` | Sidebar links |
| Body Text | `0.875rem - 0.9375rem`| `400 / 500` | normal | Paragraphs, chat messages |
| Metadata / Eyebrow | `0.6875rem - 0.75rem` | `700` | `0.05em` uppercase | Section labels, timestamps |

---

## Component Primitives

### Buttons (`.btn-*`)
- `.btn-primary`: Solid obsidian `#090d16` background with subtle inset highlight and 10px rounded corners.
- `.btn-secondary`: Clean white background with hairline border and subtle hover tint.
- `.btn-ghost`: Borderless trigger with subtle background highlight on hover.
- `.btn-invert`: Crisp white surface on dark backgrounds.

### Form Inputs & Textareas
- `.input-enterprise`: 42px height, 10px border radius, hairline border, crisp focus ring (`0 0 0 3px rgba(15, 23, 42, 0.08)`).
- `.textarea-enterprise`: 12px border radius, smooth auto-resizing, and uniform focus styling.

### Status Badges (`.badge-*`)
- `.badge`: Default compact status chip.
- `.badge-brand`: Dark badge with inverted white text.
- `.badge-success`: Mint background with emerald text (used for Durable Memory status).
- `.badge-warning`: Amber background with brown text (used for file processing).
- `.badge-info`: Blue background with navy text (used for live web citations).

### Command Palette & Modals
- **Command Palette (`components/command-palette.tsx`)**: Global `Cmd+K` launcher for instant search, page routing, and thought capture.
- **Memory Inspector Modal (`components/memory-inspector-modal.tsx`)**: Dedicated modal for viewing, searching, and managing stored memories in `content_memories`.
- **Onboarding Guide (`components/onboarding-guide.tsx`)**: Guided first-run milestones with step completion tracking.

---

## Layout Grid

- App layout uses a 260px fixed left sidebar on desktop (`.layout-grid`) and responsive top navigation on mobile devices.
- Thinking Studio (`/chats`) features a two-pane layout with a 288px thread history rail and a full-width conversational canvas with floating composer.
