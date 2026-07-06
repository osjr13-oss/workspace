-- Free full-text (keyword) search over uploaded file chunks — no embedding API needed.
--
-- Adds a generated tsvector column (Postgres' searchable, word-stemmed form of the
-- text) with a GIN index, plus a ranked search function the app calls. Safe to run
-- anytime; the feature stays off until NEXT_PUBLIC_FEATURE_HYBRID_SEARCH is enabled.

alter table public.file_chunks
  add column if not exists content_tsv tsvector
  generated always as (to_tsvector('english', content)) stored;

create index if not exists file_chunks_content_tsv_idx
  on public.file_chunks using gin (content_tsv);

-- Ranked keyword search over the caller's own file chunks. Runs as the caller
-- (security invoker) so row-level security keeps results scoped to the user;
-- the explicit user_id filter also lets the planner use the indexes.
create or replace function public.search_chunks_fts(
  p_query text,
  p_project_id uuid default null,
  p_match_count integer default 6
)
returns table (content text, rank real)
language sql
stable
security invoker
set search_path = public
as $$
  select fc.content,
         ts_rank(fc.content_tsv, websearch_to_tsquery('english', p_query)) as rank
  from public.file_chunks fc
  where fc.user_id = auth.uid()
    and (p_project_id is null or fc.project_id = p_project_id)
    and fc.content_tsv @@ websearch_to_tsquery('english', p_query)
  order by rank desc
  limit greatest(1, least(p_match_count, 20));
$$;

grant execute on function public.search_chunks_fts(text, uuid, integer) to authenticated;
