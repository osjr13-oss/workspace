-- Add indexes on foreign keys that are filtered on hot paths.
--
-- Verified missing against the live schema before writing this: flashcards had
-- only (user_id, due_at) and its primary key, and study_reviews had only its
-- primary key.
--
-- Why each one:
--   flashcards.deck_id     public deck pages (/d/[slug]) and the deck clone
--                          route both filter by deck_id, and the deck delete
--                          cascade uses it.
--   flashcards.project_id  filtered on every project-scoped chat message when
--                          building context (app/api/ai/chat/route.ts).
--   study_reviews.user_id  counted per user on every lifecycle email batch.
--   study_reviews.flashcard_id  used by record_study_review and the cascade
--                          from flashcards.
--
-- Plain CREATE INDEX rather than CONCURRENTLY: these tables are small (under
-- 100 rows) so the brief lock is irrelevant, and CONCURRENTLY cannot run inside
-- the transaction a migration executes in.

create index if not exists flashcards_deck_idx
  on public.flashcards (deck_id);

create index if not exists flashcards_project_idx
  on public.flashcards (project_id);

create index if not exists study_reviews_user_created_idx
  on public.study_reviews (user_id, created_at desc);

create index if not exists study_reviews_flashcard_idx
  on public.study_reviews (flashcard_id);
