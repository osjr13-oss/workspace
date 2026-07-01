alter table public.profiles
  alter column lifecycle_emails set default false;

update public.profiles
set lifecycle_emails = false
where lifecycle_emails = true;
