# Selrano design QA

Run this before shipping any UI change. The design rules themselves live in `DESIGN_SYSTEM.md`; this is how to check a change against them. Updated November 5, 2026.

## Setup

Run the app against the offline fakes, as the e2e tests do: `node e2e/support/mock-servers.mjs`, then `npm run dev` with the environment from `playwright.config.ts`. For signed-in pages, set the fake session cookie the way `e2e/support/session.ts` does. Live pages need no setup.

## Checklist

- **Two widths.** Take a screenshot at 1440px and at 390px of every page the change touches, scroll through the whole page, and look at each one. Sections that fade in on scroll must be visible once scrolled.
- **No sideways scroll.** At 390px, `document.documentElement.scrollWidth` must equal the viewport width. Form rows wrap instead of crushing their fields.
- **Type.** Page titles and marketing headlines are Newsreader at weight 500. Interface text is Inter. Nothing uses weight 800. Labels are sentence case, never uppercase with letter spacing.
- **Color.** Paper surfaces, ink text, and the navy `--accent` as the only brand color. The highlighter (`--highlight`) only marks cited or source text.
- **No pill badges.** No small rounded labels for statuses, counts, tags, or announcements. Plain text instead. Buttons, inputs, and citation markers are controls and are fine.
- **No em dashes** in any copy: `rg -n '\x{2014}' app components lib` returns nothing.
- **Focus.** Tab through every new control: each shows the accent focus ring.
- **Motion.** With reduced motion turned on, animations settle on their final frame. The hero demo pauses when offscreen.
- **Claims.** Every marketing claim matches what the code does and what the Privacy, Terms, and Security pages say. No exact AI message allowances on public pages, no support email or `/support` link, no fake customer logos.
- **Accessible names.** Buttons and links the e2e tests rely on keep their names, for example "Send message", "Stop responding", "Join the waitlist", and "Workspace navigation". Run `npm run test:e2e` to confirm.

## Record

Note in `docs/HANDOFF.md` what changed, which pages were checked, and anything deliberately left as is.
