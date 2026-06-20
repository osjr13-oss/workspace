alter table public.voice_sessions drop constraint if exists voice_sessions_status_check;

alter table public.voice_sessions
  add column if not exists audio_storage_path text;

alter table public.voice_sessions
  add constraint voice_sessions_status_check
  check (status in ('processing', 'transcribed', 'structuring', 'complete', 'failed'));

alter table public.voice_sessions alter column status set default 'processing';
