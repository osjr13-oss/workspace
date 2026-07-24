-- Additive Selrano personalization tables.
-- Review against production schema drift before applying.

create table if not exists public.style_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dimensions jsonb not null default '{}'::jsonb,
  style_directive text not null default '',
  confidence double precision not null default 0,
  message_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.content_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  importance double precision not null default 0.5,
  created_at timestamptz not null default now(),
  last_accessed timestamptz not null default now()
);

create index if not exists content_memories_user_rank_idx
  on public.content_memories (user_id, importance desc, last_accessed desc);

drop trigger if exists style_profiles_updated_at on public.style_profiles;
create trigger style_profiles_updated_at
  before update on public.style_profiles
  for each row execute function public.set_updated_at();

alter table public.style_profiles enable row level security;
alter table public.content_memories enable row level security;

drop policy if exists "Users can view own style profile" on public.style_profiles;
create policy "Users can view own style profile"
  on public.style_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own style profile" on public.style_profiles;
create policy "Users can insert own style profile"
  on public.style_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own style profile" on public.style_profiles;
create policy "Users can update own style profile"
  on public.style_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can view own memories" on public.content_memories;
create policy "Users can view own memories"
  on public.content_memories for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own memories" on public.content_memories;
create policy "Users can insert own memories"
  on public.content_memories for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own memories" on public.content_memories;
create policy "Users can update own memories"
  on public.content_memories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own memories" on public.content_memories;
create policy "Users can delete own memories"
  on public.content_memories for delete
  using (auth.uid() = user_id);

grant select, insert, update on public.style_profiles to authenticated;
grant select, insert, update, delete on public.content_memories to authenticated;
