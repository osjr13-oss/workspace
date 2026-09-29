-- Multiple signups have come in on @example.com, a domain reserved by internet
-- standard (RFC 2606) that can never have a real inbox — a strong signal of
-- bot/spam signups rather than real users. This blocks signup with that narrow
-- set of always-fake domains at the database level, so it can't be bypassed by
-- going straight to the Supabase Auth API (as bots typically do, skipping the
-- app's UI entirely).
--
-- Deliberately narrow: only domains that are NEVER real (example.com/org/net,
-- test, invalid, localhost). This does not touch real disposable-email
-- providers (Mailinator, temp-mail, etc.) — blocking those is a product
-- decision with real false-positive risk and isn't done here.

create or replace function public.block_placeholder_email_domains()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email ~* '@(example\.(com|org|net|edu)|test(\.(com|net))?|invalid|localhost)$' then
    raise exception 'Please sign up with a real email address.';
  end if;
  return new;
end;
$$;

drop trigger if exists block_placeholder_email_domains on auth.users;
create trigger block_placeholder_email_domains
  before insert on auth.users
  for each row execute function public.block_placeholder_email_domains();
