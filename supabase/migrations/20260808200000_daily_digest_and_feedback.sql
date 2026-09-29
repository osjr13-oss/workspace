-- Phase 3 and 4 support: digest opt-in, and a decision trail on feed items.

-- Separate toggle for the morning digest, independent of the weekly check-in.
-- Defaults to false for everyone, including existing opted-in users: the digest
-- must not start sending to anyone until it is deliberately turned on.
alter table public.profiles
  add column if not exists daily_digest boolean not null default false;

-- Phase 3 records what the user changed when they edited an item before filing
-- it, which is a stronger preference signal than approve or dismiss alone.
alter table public.feed_items
  add column if not exists edited boolean not null default false;

-- Feedback observations are written as content_memories rows with
-- kind='preference'. This index backs the Judgment layer's read of them.
create index if not exists content_memories_preference_idx
  on public.content_memories (user_id, kind, created_at desc)
  where kind = 'preference';
