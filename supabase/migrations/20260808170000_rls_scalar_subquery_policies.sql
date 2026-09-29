-- Performance: evaluate auth.uid() once per query instead of once per row.
--
-- Postgres treats a bare auth.uid() in a policy as volatile per row, so it is
-- re-executed for every row scanned. Wrapping it as (select auth.uid()) makes it
-- an InitPlan that runs a single time. This is the Supabase performance advisor
-- warning "auth_rls_initplan". The five background job tables were already
-- written this way; every original table was not.
--
-- This changes evaluation strategy only. Every policy below keeps its exact
-- name, command, target roles and predicate. Two details matter for that:
--
--   1. Most of these policies target PUBLIC, not `authenticated`. They are
--      recreated with no TO clause so they stay PUBLIC. Adding TO authenticated
--      would silently narrow access.
--   2. Predicates that are more than a plain equality (audit_logs allowing a
--      null user_id, pro_waitlist allowing a null user_id, profiles keying on
--      id rather than user_id, referrals keying on referrer_id) are preserved
--      exactly as written.
--
-- Policies deliberately untouched: "flashcard_decks public select" and
-- "flashcards public select" do not reference auth.uid(), and
-- "support_requests insert authenticated" already uses the scalar subquery.

-- ai_usage_events
drop policy if exists "ai_usage_events insert own" on public.ai_usage_events;
create policy "ai_usage_events insert own" on public.ai_usage_events
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "ai_usage_events select own" on public.ai_usage_events;
create policy "ai_usage_events select own" on public.ai_usage_events
  for select using ((select auth.uid()) = user_id);

-- audit_logs
drop policy if exists "audit_logs insert own" on public.audit_logs;
create policy "audit_logs insert own" on public.audit_logs
  for insert with check (((select auth.uid()) = user_id) or (user_id is null));

drop policy if exists "audit_logs select own" on public.audit_logs;
create policy "audit_logs select own" on public.audit_logs
  for select using ((select auth.uid()) = user_id);

-- chat_messages
drop policy if exists "chat_messages all own" on public.chat_messages;
create policy "chat_messages all own" on public.chat_messages
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- chat_threads
drop policy if exists "chat_threads all own" on public.chat_threads;
create policy "chat_threads all own" on public.chat_threads
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- content_memories
drop policy if exists "Users can view own memories" on public.content_memories;
create policy "Users can view own memories" on public.content_memories
  for select using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own memories" on public.content_memories;
create policy "Users can insert own memories" on public.content_memories
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own memories" on public.content_memories;
create policy "Users can update own memories" on public.content_memories
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own memories" on public.content_memories;
create policy "Users can delete own memories" on public.content_memories
  for delete using ((select auth.uid()) = user_id);

-- file_chunk_embeddings
drop policy if exists "file_chunk_embeddings all own" on public.file_chunk_embeddings;
create policy "file_chunk_embeddings all own" on public.file_chunk_embeddings
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- file_chunks
drop policy if exists "file_chunks all own" on public.file_chunks;
create policy "file_chunks all own" on public.file_chunks
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- files
drop policy if exists "files all own" on public.files;
create policy "files all own" on public.files
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- flashcard_decks
drop policy if exists "flashcard_decks all own" on public.flashcard_decks;
create policy "flashcard_decks all own" on public.flashcard_decks
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- flashcards
drop policy if exists "flashcards all own" on public.flashcards;
create policy "flashcards all own" on public.flashcards
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- lifecycle_email_log
drop policy if exists "lifecycle_email_log select own" on public.lifecycle_email_log;
create policy "lifecycle_email_log select own" on public.lifecycle_email_log
  for select using ((select auth.uid()) = user_id);

-- notes
drop policy if exists "notes all own" on public.notes;
create policy "notes all own" on public.notes
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- pro_waitlist (targets authenticated, not public)
drop policy if exists "pro_waitlist insert authenticated" on public.pro_waitlist;
create policy "pro_waitlist insert authenticated" on public.pro_waitlist
  for insert to authenticated with check ((user_id is null) or ((select auth.uid()) = user_id));

-- profiles (keyed on id, not user_id)
drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own" on public.profiles
  for select using ((select auth.uid()) = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- projects
drop policy if exists "projects all own" on public.projects;
create policy "projects all own" on public.projects
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- referrals (keyed on referrer_id)
drop policy if exists "referrals select own" on public.referrals;
create policy "referrals select own" on public.referrals
  for select using ((select auth.uid()) = referrer_id);

-- study_reviews
drop policy if exists "study_reviews all own" on public.study_reviews;
create policy "study_reviews all own" on public.study_reviews
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- style_profiles
drop policy if exists "Users can view own style profile" on public.style_profiles;
create policy "Users can view own style profile" on public.style_profiles
  for select using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own style profile" on public.style_profiles;
create policy "Users can insert own style profile" on public.style_profiles
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own style profile" on public.style_profiles;
create policy "Users can update own style profile" on public.style_profiles
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- support_requests (select only; the insert policy is already optimized)
drop policy if exists "support_requests select own" on public.support_requests;
create policy "support_requests select own" on public.support_requests
  for select using ((select auth.uid()) = user_id);

-- user_limits
drop policy if exists "user_limits select own" on public.user_limits;
create policy "user_limits select own" on public.user_limits
  for select using ((select auth.uid()) = user_id);
