-- Additive chat schema. Uses create-if-not-exists and add-column-if-not-exists
-- so an existing Supabase project is not wiped. There is no projects table.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  welcome_email_sent_at timestamptz,
  lifecycle_emails boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists welcome_email_sent_at timestamptz;
alter table public.profiles add column if not exists lifecycle_emails boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles alter column lifecycle_emails set default false;

create table if not exists public.user_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free',
  daily_requests integer not null default 20,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text not null default 'none',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_limits add column if not exists tier text not null default 'free';
alter table public.user_limits add column if not exists daily_requests integer not null default 20;
alter table public.user_limits add column if not exists stripe_customer_id text;
alter table public.user_limits add column if not exists stripe_subscription_id text;
alter table public.user_limits add column if not exists subscription_status text not null default 'none';
alter table public.user_limits add column if not exists current_period_end timestamptz;
alter table public.user_limits add column if not exists created_at timestamptz not null default now();
alter table public.user_limits add column if not exists updated_at timestamptz not null default now();

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chat_threads add column if not exists model text;
alter table public.chat_threads add column if not exists title text not null default 'New conversation';
alter table public.chat_threads add column if not exists updated_at timestamptz not null default now();

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  artifacts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.chat_messages add column if not exists citations jsonb not null default '[]'::jsonb;
alter table public.chat_messages add column if not exists artifacts jsonb not null default '[]'::jsonb;

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid,
  name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  extraction_status text not null default 'pending',
  extracted_text text,
  created_at timestamptz not null default now()
);

alter table public.files add column if not exists thread_id uuid;
alter table public.files add column if not exists storage_path text;
alter table public.files add column if not exists mime_type text;
alter table public.files add column if not exists size_bytes bigint;
alter table public.files add column if not exists extraction_status text not null default 'pending';
alter table public.files add column if not exists extracted_text text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'files_thread_id_fkey') then
    alter table public.files
      add constraint files_thread_id_fkey
      foreign key (thread_id) references public.chat_threads(id) on delete set null;
  end if;
end $$;

create table if not exists public.file_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  page_number integer,
  char_start integer,
  char_end integer,
  created_at timestamptz not null default now()
);

alter table public.file_chunks add column if not exists page_number integer;
alter table public.file_chunks add column if not exists char_start integer;
alter table public.file_chunks add column if not exists char_end integer;

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid,
  title text not null default 'Untitled note',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes add column if not exists thread_id uuid;
alter table public.notes add column if not exists title text not null default 'Untitled note';
alter table public.notes add column if not exists content text not null default '';
alter table public.notes add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'notes_thread_id_fkey') then
    alter table public.notes
      add constraint notes_thread_id_fkey
      foreign key (thread_id) references public.chat_threads(id) on delete set null;
  end if;
end $$;

create table if not exists public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.flashcard_decks add column if not exists thread_id uuid;
alter table public.flashcard_decks add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'flashcard_decks_thread_id_fkey') then
    alter table public.flashcard_decks
      add constraint flashcard_decks_thread_id_fkey
      foreign key (thread_id) references public.chat_threads(id) on delete set null;
  end if;
end $$;

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.flashcard_decks(id) on delete cascade,
  front text not null,
  back text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.flashcards add column if not exists updated_at timestamptz not null default now();

create table if not exists public.lifecycle_email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_key text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, email_key)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.ensure_chat_user_rows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;

  insert into public.user_limits (user_id, tier, daily_requests)
  values (new.id, 'free', 20)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_chat on auth.users;
create trigger on_auth_user_created_chat
  after insert on auth.users
  for each row execute function public.ensure_chat_user_rows();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists user_limits_updated_at on public.user_limits;
create trigger user_limits_updated_at before update on public.user_limits for each row execute function public.set_updated_at();

drop trigger if exists chat_threads_updated_at on public.chat_threads;
create trigger chat_threads_updated_at before update on public.chat_threads for each row execute function public.set_updated_at();

drop trigger if exists notes_updated_at on public.notes;
create trigger notes_updated_at before update on public.notes for each row execute function public.set_updated_at();

drop trigger if exists flashcard_decks_updated_at on public.flashcard_decks;
create trigger flashcard_decks_updated_at before update on public.flashcard_decks for each row execute function public.set_updated_at();

drop trigger if exists flashcards_updated_at on public.flashcards;
create trigger flashcards_updated_at before update on public.flashcards for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_limits enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.files enable row level security;
alter table public.file_chunks enable row level security;
alter table public.notes enable row level security;
alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;
alter table public.lifecycle_email_log enable row level security;

do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('chat_threads'),
      ('chat_messages'),
      ('files'),
      ('file_chunks'),
      ('notes'),
      ('flashcard_decks'),
      ('flashcards')
    ) as t(name)
  loop
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = rec.name
    ) then
      execute format(
        'create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
        rec.name || ' own',
        rec.name
      );
    end if;
  end loop;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles') then
    create policy "profiles select own" on public.profiles for select using (auth.uid() = id);
    create policy "profiles update own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_limits') then
    create policy "user_limits select own" on public.user_limits for select using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lifecycle_email_log') then
    create policy "lifecycle_email_log select own" on public.lifecycle_email_log for select using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists chat_threads_user_updated_idx on public.chat_threads (user_id, updated_at desc);
create index if not exists chat_messages_thread_created_idx on public.chat_messages (thread_id, created_at);
create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at desc);
create index if not exists flashcard_decks_user_updated_idx on public.flashcard_decks (user_id, updated_at desc);
create index if not exists files_user_created_idx on public.files (user_id, created_at desc);
create index if not exists file_chunks_file_idx on public.file_chunks (file_id, chunk_index);
create index if not exists lifecycle_email_log_user_idx on public.lifecycle_email_log (user_id, sent_at desc);

grant usage on schema public to authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.user_limits to authenticated;
grant select, insert, update, delete on public.chat_threads to authenticated;
grant select, insert, update, delete on public.chat_messages to authenticated;
grant select, insert, update, delete on public.files to authenticated;
grant select, insert, update, delete on public.file_chunks to authenticated;
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.flashcard_decks to authenticated;
grant select, insert, update, delete on public.flashcards to authenticated;
grant select on public.lifecycle_email_log to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on public.profiles to service_role;
    grant all on public.user_limits to service_role;
    grant all on public.chat_threads to service_role;
    grant all on public.chat_messages to service_role;
    grant all on public.files to service_role;
    grant all on public.file_chunks to service_role;
    grant all on public.notes to service_role;
    grant all on public.flashcard_decks to service_role;
    grant all on public.flashcards to service_role;
    grant all on public.lifecycle_email_log to service_role;
  end if;
end $$;
