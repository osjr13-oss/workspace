-- Selrano is a private personal AI (owner decision 2026-11-19).
-- Removes public and plan-era database behavior. Idempotent, and changes no rows:
-- tables and their data (decks, cards, waitlist, support requests) are kept.

-- No plans: stop the free-plan project and deck caps.
drop trigger if exists projects_plan_limit on public.projects;
drop trigger if exists decks_plan_limit on public.flashcard_decks;

-- No public deck links: nobody can read decks or cards they do not own.
drop policy if exists "flashcard_decks public select" on public.flashcard_decks;
drop policy if exists "flashcards public select" on public.flashcards;

-- No waitlist or support inbox: the browser can no longer insert rows.
drop policy if exists "pro_waitlist insert anon" on public.pro_waitlist;
drop policy if exists "pro_waitlist insert authenticated" on public.pro_waitlist;
drop policy if exists "support_requests insert anon" on public.support_requests;
drop policy if exists "support_requests insert authenticated" on public.support_requests;
