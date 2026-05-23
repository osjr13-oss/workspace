create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null default 'Untitled note',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  extraction_status text not null default 'pending' check (extraction_status in ('pending', 'ready', 'unsupported', 'failed')),
  extracted_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.file_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  chunk_index integer not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.flashcard_decks(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  front text not null,
  back text not null,
  source_type text,
  source_id uuid,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  result text not null check (result in ('correct', 'incorrect')),
  created_at timestamptz not null default now()
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();

drop trigger if exists notes_updated_at on public.notes;
create trigger notes_updated_at before update on public.notes for each row execute function public.set_updated_at();

drop trigger if exists chat_threads_updated_at on public.chat_threads;
create trigger chat_threads_updated_at before update on public.chat_threads for each row execute function public.set_updated_at();

drop trigger if exists flashcard_decks_updated_at on public.flashcard_decks;
create trigger flashcard_decks_updated_at before update on public.flashcard_decks for each row execute function public.set_updated_at();

drop trigger if exists flashcards_updated_at on public.flashcards;
create trigger flashcards_updated_at before update on public.flashcards for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.notes enable row level security;
alter table public.files enable row level security;
alter table public.file_chunks enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;
alter table public.study_reviews enable row level security;

create policy "profiles select own" on public.profiles for select using (auth.uid() = id);
create policy "profiles update own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "projects all own" on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes all own" on public.notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "files all own" on public.files for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "file_chunks all own" on public.file_chunks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "chat_threads all own" on public.chat_threads for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "chat_messages all own" on public.chat_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "flashcard_decks all own" on public.flashcard_decks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "flashcards all own" on public.flashcards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "study_reviews all own" on public.study_reviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('workspace-files', 'workspace-files', false)
on conflict (id) do nothing;

create policy "workspace files select own" on storage.objects
for select using (
  bucket_id = 'workspace-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "workspace files insert own" on storage.objects
for insert with check (
  bucket_id = 'workspace-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "workspace files update own" on storage.objects
for update using (
  bucket_id = 'workspace-files'
  and auth.uid()::text = (storage.foldername(name))[1]
) with check (
  bucket_id = 'workspace-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "workspace files delete own" on storage.objects
for delete using (
  bucket_id = 'workspace-files'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create index if not exists projects_user_updated_idx on public.projects(user_id, updated_at desc);
create index if not exists notes_user_project_updated_idx on public.notes(user_id, project_id, updated_at desc);
create index if not exists files_user_project_created_idx on public.files(user_id, project_id, created_at desc);
create index if not exists file_chunks_project_idx on public.file_chunks(user_id, project_id, file_id, chunk_index);
create index if not exists chat_threads_user_updated_idx on public.chat_threads(user_id, updated_at desc);
create index if not exists chat_messages_thread_created_idx on public.chat_messages(thread_id, created_at);
create index if not exists flashcards_due_idx on public.flashcards(user_id, due_at);
