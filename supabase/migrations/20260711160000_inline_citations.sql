-- Inline citations: preserve where each file_chunk came from (page for PDFs,
-- character offsets for everything) and persist the citation markers resolved
-- for each assistant chat message. Additive only; no RLS changes needed —
-- file_chunks and chat_messages already have owner-only policies that cover
-- these new columns automatically.

alter table public.file_chunks
  add column if not exists page_number integer;

alter table public.file_chunks
  add column if not exists char_start integer;

alter table public.file_chunks
  add column if not exists char_end integer;

alter table public.chat_messages
  add column if not exists citations jsonb not null default '[]'::jsonb;

-- Extend the semantic-search RPC to also return chunk id, file id/name, and
-- location, so the chat route can build citation markers instead of a flat
-- text blob. Return shape changed, so drop before recreating.
drop function if exists public.match_file_chunks(uuid, vector(1536), int);

create function public.match_file_chunks(
  p_project_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 6
)
returns table (
  chunk_id uuid,
  content text,
  similarity float,
  file_id uuid,
  file_name text,
  page_number integer,
  char_start integer,
  char_end integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    fc.id as chunk_id,
    fc.content,
    1 - (fce.embedding <=> p_query_embedding) as similarity,
    fc.file_id,
    f.name as file_name,
    fc.page_number,
    fc.char_start,
    fc.char_end
  from public.file_chunk_embeddings fce
  join public.file_chunks fc on fc.id = fce.chunk_id
  join public.files f on f.id = fc.file_id
  where fce.project_id = p_project_id
    and fce.user_id = auth.uid()
  order by fce.embedding <=> p_query_embedding
  limit greatest(p_match_count, 1);
$$;

grant execute on function public.match_file_chunks(uuid, vector(1536), int) to authenticated;

-- Same extension for the full-text keyword search RPC.
drop function if exists public.search_chunks_fts(text, uuid, integer);

create function public.search_chunks_fts(
  p_query text,
  p_project_id uuid default null,
  p_match_count integer default 6
)
returns table (
  content text,
  rank real,
  chunk_id uuid,
  file_id uuid,
  file_name text,
  page_number integer,
  char_start integer,
  char_end integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    fc.content,
    ts_rank(fc.content_tsv, websearch_to_tsquery('english', p_query)) as rank,
    fc.id as chunk_id,
    fc.file_id,
    f.name as file_name,
    fc.page_number,
    fc.char_start,
    fc.char_end
  from public.file_chunks fc
  join public.files f on f.id = fc.file_id
  where fc.user_id = auth.uid()
    and (p_project_id is null or fc.project_id = p_project_id)
    and fc.content_tsv @@ websearch_to_tsquery('english', p_query)
  order by rank desc
  limit greatest(1, least(p_match_count, 20));
$$;

grant execute on function public.search_chunks_fts(text, uuid, integer) to authenticated;
