-- Remove Voice Study experiment (database only).
-- Safe to run even if 008/009 were never applied.
-- Voice recordings in storage: run `npm run cleanup:voice-storage` (Storage API).

drop trigger if exists voice_sessions_updated_at on public.voice_sessions;
drop policy if exists "voice_sessions all own" on public.voice_sessions;
drop index if exists voice_sessions_user_created_idx;
drop table if exists public.voice_sessions;
