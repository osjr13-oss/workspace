-- Separate durable facts from preference observations in content_memories.
--
-- Phase 3 writes feed feedback (approve / dismiss / edit) into the memory
-- system as preference observations, for example "this user dismisses
-- flashcards made from short notes". Those observations are input for the
-- Judgment layer, not things the user should ever see quoted back in a chat
-- reply. Without a discriminator they would land in the same table that chat
-- recall reads from and would leak into conversations.
--
-- Existing rows are all durable facts, so the default backfills them correctly
-- and chat recall behaves exactly as it does today. Nothing writes 'preference'
-- rows until Phase 3.

alter table public.content_memories
  add column if not exists kind text not null default 'durable';

do $$ begin
  alter table public.content_memories add constraint content_memories_kind_check
    check (kind = any (array['durable','preference']));
exception when duplicate_object then null; end $$;

-- Chat recall now filters on kind, so the ranking index needs it too.
create index if not exists content_memories_user_kind_rank_idx
  on public.content_memories (user_id, kind, importance desc, last_accessed desc);
