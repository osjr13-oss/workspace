-- Growth feature: shareable public flashcard deck pages.
-- Additive only — existing owner-only policies on flashcard_decks and
-- flashcards are left in place; this adds a second, public-read policy
-- alongside them (RLS policies are OR'd together).

alter table public.flashcard_decks
  add column if not exists is_public boolean not null default false;

alter table public.flashcard_decks
  add column if not exists share_slug text;

-- Partial unique index: only enforces uniqueness once a slug is assigned,
-- so the default (null) state for every existing/new private deck is fine.
create unique index if not exists flashcard_decks_share_slug_key
  on public.flashcard_decks (share_slug)
  where share_slug is not null;

drop policy if exists "flashcard_decks public select" on public.flashcard_decks;
create policy "flashcard_decks public select" on public.flashcard_decks
  for select
  using (is_public = true);

drop policy if exists "flashcards public select" on public.flashcards;
create policy "flashcards public select" on public.flashcards
  for select
  using (
    exists (
      select 1
      from public.flashcard_decks d
      where d.id = flashcards.deck_id
        and d.is_public = true
    )
  );

create index if not exists flashcard_decks_is_public_idx
  on public.flashcard_decks (is_public)
  where is_public = true;
