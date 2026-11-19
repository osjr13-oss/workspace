-- Memory recall by meaning, plus the Memory page (owner decision 2026-11-19).
--
-- Each durable memory gets an embedding so a chat message can be matched to it
-- by meaning, not shared words. The owner can pin, edit and delete memories,
-- and `source` records whether a memory came from a chat, earlier history, or
-- was added by hand. Idempotent and additive: no rows are changed or removed.

create extension if not exists vector;

alter table public.content_memories add column if not exists embedding vector(1536);
alter table public.content_memories add column if not exists embedding_model text;
alter table public.content_memories add column if not exists pinned boolean not null default false;
alter table public.content_memories add column if not exists source text not null default 'chat';
alter table public.content_memories add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'content_memories_source_check') then
    alter table public.content_memories add constraint content_memories_source_check
      check (source = any (array['chat', 'manual', 'history']));
  end if;
end $$;

create index if not exists content_memories_user_pinned_idx
  on public.content_memories (user_id, kind, pinned desc, updated_at desc);

-- Closest durable memories to a query, for the signed-in user only.
create or replace function public.match_memories(
  p_query_embedding vector(1536),
  p_model text,
  p_match_count int default 12
)
returns table (id uuid, similarity float)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select m.id, 1 - (m.embedding <=> p_query_embedding) as similarity
  from public.content_memories m
  where m.user_id = auth.uid()
    and m.kind = 'durable'
    and m.embedding is not null
    and m.embedding_model = p_model
  order by m.embedding <=> p_query_embedding
  limit least(greatest(p_match_count, 1), 50);
$$;

grant execute on function public.match_memories(vector(1536), text, int) to authenticated;
