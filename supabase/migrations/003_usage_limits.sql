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

create policy "ai_usage_events insert own" on public.ai_usage_events
  for insert with check (auth.uid() = user_id);

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
