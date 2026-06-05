alter table public.profiles
  add column if not exists lifecycle_emails boolean not null default true;

create table if not exists public.lifecycle_email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_key text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, email_key)
);

create index if not exists lifecycle_email_log_user_idx on public.lifecycle_email_log(user_id, sent_at desc);

alter table public.lifecycle_email_log enable row level security;

create policy "lifecycle_email_log select own" on public.lifecycle_email_log
  for select using (auth.uid() = user_id);

grant select on public.lifecycle_email_log to authenticated;
