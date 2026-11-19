-- Personal finance through Plaid (owner decision 2026-11-19). Read-only bank data.
--
-- plaid_items holds each bank login with its Plaid access token, encrypted by
-- the server (lib/secret-box.ts). Browser roles cannot read it at all.
-- plaid_accounts and plaid_transactions are written only by the server; the
-- signed-in owner may read their own rows. Idempotent and additive.

create table if not exists public.plaid_items (
  item_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_token_encrypted text not null,
  institution_id text,
  institution_name text,
  environment text not null default 'sandbox',
  cursor text,
  status text not null default 'ok',
  error_code text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plaid_items_user_idx on public.plaid_items (user_id, environment);
alter table public.plaid_items enable row level security;
revoke all on public.plaid_items from anon, authenticated;
grant all on public.plaid_items to service_role;

create table if not exists public.plaid_accounts (
  account_id text primary key,
  item_id text not null references public.plaid_items(item_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  official_name text,
  mask text,
  type text not null,
  subtype text,
  current_balance numeric(14, 2),
  available_balance numeric(14, 2),
  credit_limit numeric(14, 2),
  iso_currency_code text,
  updated_at timestamptz not null default now()
);
create index if not exists plaid_accounts_user_idx on public.plaid_accounts (user_id);

create table if not exists public.plaid_transactions (
  transaction_id text primary key,
  item_id text not null references public.plaid_items(item_id) on delete cascade,
  account_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14, 2) not null,
  iso_currency_code text,
  date date not null,
  authorized_date date,
  name text not null,
  merchant_name text,
  pending boolean not null default false,
  payment_channel text,
  logo_url text,
  category text,
  category_detailed text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plaid_transactions_user_date_idx on public.plaid_transactions (user_id, date desc);

alter table public.plaid_accounts enable row level security;
alter table public.plaid_transactions enable row level security;
revoke all on public.plaid_accounts from anon, authenticated;
revoke all on public.plaid_transactions from anon, authenticated;
grant select on public.plaid_accounts to authenticated;
grant select on public.plaid_transactions to authenticated;
grant all on public.plaid_accounts to service_role;
grant all on public.plaid_transactions to service_role;

drop policy if exists "plaid_accounts select own" on public.plaid_accounts;
create policy "plaid_accounts select own" on public.plaid_accounts
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "plaid_transactions select own" on public.plaid_transactions;
create policy "plaid_transactions select own" on public.plaid_transactions
  for select to authenticated using ((select auth.uid()) = user_id);
