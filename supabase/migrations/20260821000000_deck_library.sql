-- Deck library: browsable public decks with subject categories and
-- duplicate counts, powering selrano.com/library.
-- Additive and idempotent only.

alter table public.flashcard_decks
  add column if not exists category text;

alter table public.flashcard_decks
  add column if not exists duplicate_count integer not null default 0;

create index if not exists flashcard_decks_public_listing_idx
  on public.flashcard_decks (duplicate_count desc, updated_at desc)
  where is_public = true;

-- Owner-rights view on purpose: the library must be readable by signed-out
-- visitors, and every exposed row is already publicly readable through the
-- "flashcard_decks public select" policy. Do not switch this view to
-- security_invoker: under RLS the anon role would then see no rows at all.
create or replace view public.public_deck_library as
select
  d.id,
  d.name,
  d.share_slug,
  d.category,
  d.duplicate_count,
  d.created_at,
  d.updated_at,
  (
    select count(*)
    from public.flashcards f
    where f.deck_id = d.id
  ) as card_count
from public.flashcard_decks d
where d.is_public = true
  and d.share_slug is not null;

grant select on public.public_deck_library to anon, authenticated, service_role;

-- Atomic popularity counter for the clone flow. Security definer so the
-- copying user can bump the counter without write access to the source row.
create or replace function public.record_public_deck_duplicate(p_share_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.flashcard_decks
  set duplicate_count = duplicate_count + 1
  where share_slug = p_share_slug
    and is_public = true;
$$;

revoke all on function public.record_public_deck_duplicate(text) from public, anon;
grant execute on function public.record_public_deck_duplicate(text) to authenticated;
