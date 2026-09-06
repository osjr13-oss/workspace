-- Additive migration. Existing workspace content and billing remain intact.
create table if not exists public.security_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  host text not null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  score integer check (score between 0 and 100),
  summary text,
  finding_count integer not null default 0,
  report jsonb,
  failure text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, user_id)
);
create index if not exists security_scans_user_created_idx on public.security_scans(user_id, created_at desc);

create table if not exists public.security_copilot_messages (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(content) between 1 and 50000),
  created_at timestamptz not null default now(),
  foreign key (scan_id, user_id) references public.security_scans(id, user_id) on delete cascade
);
create index if not exists security_copilot_scan_created_idx on public.security_copilot_messages(scan_id, created_at);
create index if not exists security_copilot_user_idx on public.security_copilot_messages(user_id);

alter table public.security_scans enable row level security;
alter table public.security_copilot_messages enable row level security;
revoke all on public.security_scans, public.security_copilot_messages from anon, authenticated;
grant select on public.security_scans, public.security_copilot_messages to authenticated;
grant all on public.security_scans, public.security_copilot_messages to service_role;
-- Scan results, message roles and usage enforcement are server-owned.
drop policy if exists security_scans_read_own on public.security_scans;
create policy security_scans_read_own on public.security_scans for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists security_copilot_read_own on public.security_copilot_messages;
create policy security_copilot_read_own on public.security_copilot_messages for select to authenticated using ((select auth.uid()) = user_id);
