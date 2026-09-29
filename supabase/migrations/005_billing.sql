alter table public.user_limits
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text not null default 'none',
  add column if not exists current_period_end timestamptz;

-- Free tier defaults (existing rows keep tier; adjust daily_requests for free users)
update public.user_limits
set daily_requests = 20
where tier = 'free' or tier is null;

alter table public.user_limits alter column daily_requests set default 20;

create or replace function public.handle_new_user_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_limits (user_id, tier, daily_requests)
  values (new.id, 'free', 20)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
