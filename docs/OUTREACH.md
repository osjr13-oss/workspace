# 30-day student outreach runbook

Use this when seeding the first student cohorts. Goal: get classmates into a private materials workspace, not pitch Selrano as a Quizlet clone.

Public product: `https://www.selrano.com`  
Signup: `https://www.selrano.com/signup`  
Guides:

- `https://www.selrano.com/guides/study-from-lecture-pdfs`
- `https://www.selrano.com/guides/private-study-workspace`
- `https://www.selrano.com/guides/free-quizlet-alternative`

## Public starter decks

Share these when someone wants an immediate try without uploading yet. Still steer them toward uploading their own syllabus or lecture PDF afterward.

| Deck | URL |
|---|---|
| Intro Psych Foundations | https://www.selrano.com/d/intro-psych-foundations |
| Calc 1 Derivatives | https://www.selrano.com/d/calc-1-derivatives |
| Bio 101 Cell Basics | https://www.selrano.com/d/bio-101-cell-basics |
| CS 101 Programming Fundamentals | https://www.selrano.com/d/cs-101-programming-fundamentals |
| Chem 101 Atoms and Moles | https://www.selrano.com/d/chem-101-atoms-and-moles |
| US History Founding Era | https://www.selrano.com/d/us-history-founding-era |
| Macroeconomics Core | https://www.selrano.com/d/macroeconomics-core |
| Spanish 1 Core Verbs | https://www.selrano.com/d/spanish-1-core-verbs |

Seed data lives in `lib/seed-public-decks-data.ts`.

To publish them (no terminal needed): sign in to Selrano → Settings → **Publish starter decks**.

## Positioning rules

- Lead with materials: syllabus, lecture PDF, notes, then grounded questions.
- Flashcards are one useful output, not the whole product.
- Do not advertise exact AI message quotas on public posts or campus flyers.
- Keep the Selrano name; no emoji-heavy marketing copy.
- Never use Unicode em dashes in outreach copy.

## 30-day cadence

### Days 1-3: Campus and Discord soft launch

Post in 2-3 class Discords, GroupMes, or Slack channels where people already trade notes.

Template:

```text
If you want a calmer place for class PDFs + notes + questions in one project, try Selrano.

1) Sign up: https://www.selrano.com/signup
2) Upload a syllabus or lecture PDF
3) Ask a question from that project

Starter decks if you want to poke around first:
https://www.selrano.com/d/intro-psych-foundations
https://www.selrano.com/d/calc-1-derivatives
```

### Days 4-7: One-to-one invites

DM 10 people who already share notes with you.

Template:

```text
Quick ask: I'm using Selrano for [class]. You upload the lecture PDF, then ask questions from that project instead of bouncing between Drive and chat.

Free to try: https://www.selrano.com/signup

If helpful, here's a starter deck for [subject]:
[public deck URL]
```

### Days 8-14: Study-group wedge

Offer to set up one shared workflow for a midterm group: one project per class, upload the week's slides, ask from there.

Template:

```text
For the midterm group: want to keep this week's slides in one Selrano project and ask from there?

Flow:
- create / open the class project
- upload the PDF
- ask the confusing parts in chat
- turn the hard sections into review cards if useful

Signup: https://www.selrano.com/signup
Guide: https://www.selrano.com/guides/study-from-lecture-pdfs
```

### Days 15-21: Course-page and newsletter mentions

Share the materials-first guides, not feature laundry lists.

Template:

```text
Working from your own lecture PDFs?

This walkthrough shows a simple loop: upload, ask grounded questions, then review what still feels shaky.
https://www.selrano.com/guides/study-from-lecture-pdfs

Private workspace overview:
https://www.selrano.com/guides/private-study-workspace
```

### Days 22-30: Referral push + office-hours demo

Ask activated users to invite two classmates. Use the in-app referral link from Settings / billing, not a generic `ref=free_pro` string.

Template:

```text
If Selrano helped with [class], send your invite link to two people in the same course.

They get a workspace for their own materials. When three friends join through your link, you unlock a free Pro month.
```

Campus table / office-hours demo script:

```text
1. Sign up and land on dashboard
2. Open the Fall 2026 starter project
3. Upload one short lecture PDF
4. Ask: "What should I review from this lecture?"
5. Optional: generate a small deck from the same file
6. Show a public starter deck only as a secondary path
```

## Channel checklist

- [ ] 3 class Discords / GroupMes
- [ ] 10 personal DMs
- [ ] 1 study-group workflow
- [ ] 2 guide posts
- [ ] 5 referral asks from activated users
- [ ] Track which public deck URLs get clicks

## What success looks like

- New accounts reach dashboard and open the starter project
- At least one file or note uploaded in the first session
- At least one project-aware chat
- Referrals come from real class networks, not spam blasts
