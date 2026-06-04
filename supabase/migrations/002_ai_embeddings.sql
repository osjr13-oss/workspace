create extension if not exists vector;

create table if not exists public.file_chunk_embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  chunk_id uuid not null references public.file_chunks(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  embedding vector(1536) not null,
  model text not null,
  created_at timestamptz not null default now(),
  unique (chunk_id)
);

create index if not exists file_chunk_embeddings_project_idx on public.file_chunk_embeddings(user_id, project_id);
create index if not exists file_chunk_embeddings_hnsw_idx
  on public.file_chunk_embeddings
  using hnsw (embedding vector_cosine_ops);

alter table public.file_chunk_embeddings enable row level security;

create policy "file_chunk_embeddings all own" on public.file_chunk_embeddings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant all on public.file_chunk_embeddings to anon, authenticated;

create or replace function public.match_file_chunks(
  p_project_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 6
)
returns table (
  chunk_id uuid,
  content text,
  similarity float
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    fc.id as chunk_id,
    fc.content,
    1 - (fce.embedding <=> p_query_embedding) as similarity
  from public.file_chunk_embeddings fce
  join public.file_chunks fc on fc.id = fce.chunk_id
  where fce.project_id = p_project_id
    and fce.user_id = auth.uid()
  order by fce.embedding <=> p_query_embedding
  limit greatest(p_match_count, 1);
$$;

grant execute on function public.match_file_chunks(uuid, vector(1536), int) to authenticated;
