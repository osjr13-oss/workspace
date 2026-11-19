-- Connected Google account (Gmail and Google Calendar) for the private owner.
-- Owner decision 2026-11-19: read mail and calendar, save drafts (never send),
-- add events the owner confirms.
--
-- Tokens are encrypted by the server before they are stored (lib/secret-box.ts).
-- Browser roles get no access at all: row-level security is on with no
-- policies, and grants are revoked, so only the server role can read or write.
-- Idempotent and additive.

create table if not exists public.google_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  scopes text[] not null default '{}',
  refresh_token_encrypted text not null,
  access_token_encrypted text,
  access_token_expires_at timestamptz,
  time_zone text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_connections enable row level security;
revoke all on public.google_connections from anon, authenticated;
grant all on public.google_connections to service_role;
