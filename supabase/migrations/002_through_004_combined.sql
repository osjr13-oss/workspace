-- Run this ONCE in Supabase SQL Editor if you already ran 001_initial_schema.sql
-- and have NOT yet run 002, 003, or 004 individually.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible.

-- ========== 002: AI embeddings (pgvector) ==========
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

drop policy if exists "file_chunk_embeddings all own" on public.file_chunk_embeddings;
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

-- ========== 003: AI usage limits ==========
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  route text not null,
  model text,
  input_chars integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_user_day_idx on public.ai_usage_events(user_id, created_at desc);

alter table public.ai_usage_events enable row level security;

drop policy if exists "ai_usage_events insert own" on public.ai_usage_events;
create policy "ai_usage_events insert own" on public.ai_usage_events
  for insert with check (auth.uid() = user_id);

drop policy if exists "ai_usage_events select own" on public.ai_usage_events;
create policy "ai_usage_events select own" on public.ai_usage_events
  for select using (auth.uid() = user_id);

grant all on public.ai_usage_events to anon, authenticated;

create table if not exists public.user_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free',
  daily_requests integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_limits enable row level security;

drop policy if exists "user_limits select own" on public.user_limits;
create policy "user_limits select own" on public.user_limits
  for select using (auth.uid() = user_id);

grant select on public.user_limits to authenticated;

create or replace function public.handle_new_user_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_limits (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_limits on auth.users;
create trigger on_auth_user_created_limits
  after insert on auth.users
  for each row execute function public.handle_new_user_limits();

grant all on public.user_limits to anon, authenticated;

-- Backfill limits for existing users
insert into public.user_limits (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- ========== 004: Support + audit ==========
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_requests_email_idx on public.support_requests(email, created_at desc);
create index if not exists support_requests_status_idx on public.support_requests(status, created_at desc);

drop trigger if exists support_requests_updated_at on public.support_requests;
create trigger support_requests_updated_at
  before update on public.support_requests
  for each row execute function public.set_updated_at();

alter table public.support_requests enable row level security;

drop policy if exists "support_requests insert authenticated" on public.support_requests;
create policy "support_requests insert authenticated" on public.support_requests
  for insert to authenticated
  with check (auth.uid() = user_id or user_id is null);

drop policy if exists "support_requests select own" on public.support_requests;
create policy "support_requests select own" on public.support_requests
  for select using (auth.uid() = user_id);

drop policy if exists "support_requests insert anon" on public.support_requests;
create policy "support_requests insert anon" on public.support_requests
  for insert to anon
  with check (user_id is null);

grant insert, select on public.support_requests to anon, authenticated;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_user_created_idx on public.audit_logs(user_id, created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs(action, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs insert own" on public.audit_logs;
create policy "audit_logs insert own" on public.audit_logs
  for insert with check (auth.uid() = user_id or user_id is null);

drop policy if exists "audit_logs select own" on public.audit_logs;
create policy "audit_logs select own" on public.audit_logs
  for select using (auth.uid() = user_id);

grant insert, select on public.audit_logs to authenticated;
grant insert on public.audit_logs to anon;
