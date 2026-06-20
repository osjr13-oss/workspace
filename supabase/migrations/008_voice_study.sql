create table if not exists public.voice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  status text not null default 'transcribed'
    check (status in ('transcribed', 'structuring', 'complete', 'failed')),
  raw_transcription text,
  audio_mime_type text,
  duration_seconds integer,
  note_id uuid references public.notes(id) on delete set null,
  deck_id uuid references public.flashcard_decks(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists voice_sessions_user_created_idx on public.voice_sessions(user_id, created_at desc);

drop trigger if exists voice_sessions_updated_at on public.voice_sessions;
create trigger voice_sessions_updated_at
  before update on public.voice_sessions
  for each row execute function public.set_updated_at();

alter table public.voice_sessions enable row level security;

create policy "voice_sessions all own" on public.voice_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant all on public.voice_sessions to authenticated;
