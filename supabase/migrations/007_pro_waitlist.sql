create table if not exists public.pro_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid references auth.users(id) on delete set null,
  source text not null default 'pro_waitlist',
  ip_address text,
  created_at timestamptz not null default now(),
  constraint pro_waitlist_email_unique unique (email)
);

create index if not exists pro_waitlist_created_idx on public.pro_waitlist(created_at desc);
create index if not exists pro_waitlist_email_idx on public.pro_waitlist(email);

alter table public.pro_waitlist enable row level security;

create policy "pro_waitlist insert authenticated" on public.pro_waitlist
  for insert to authenticated
  with check (user_id is null or auth.uid() = user_id);

create policy "pro_waitlist insert anon" on public.pro_waitlist
  for insert to anon
  with check (user_id is null);

grant insert on public.pro_waitlist to anon, authenticated;
