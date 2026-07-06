alter table public.pro_waitlist
  add column if not exists pro_launch_emailed_at timestamptz;

create index if not exists pro_waitlist_launch_email_idx
  on public.pro_waitlist(pro_launch_emailed_at, created_at);
