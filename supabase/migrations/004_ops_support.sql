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

create policy "support_requests insert authenticated" on public.support_requests
  for insert to authenticated
  with check (auth.uid() = user_id or user_id is null);

create policy "support_requests select own" on public.support_requests
  for select using (auth.uid() = user_id);

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

create policy "audit_logs insert own" on public.audit_logs
  for insert with check (auth.uid() = user_id or user_id is null);

create policy "audit_logs select own" on public.audit_logs
  for select using (auth.uid() = user_id);

grant insert, select on public.audit_logs to authenticated;
grant insert on public.audit_logs to anon;
