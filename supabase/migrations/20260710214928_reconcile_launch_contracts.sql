-- Reconcile production with the launch contracts enforced by the application.
-- This migration is intentionally idempotent so it is safe after the earlier
-- SQL-editor changes that were applied without migration history.

alter table public.profiles
  alter column lifecycle_emails set default false;

alter table public.profiles
  add column if not exists welcome_email_sent_at timestamptz;

-- Do not send a retroactive welcome email to accounts that predate this fix.
update public.profiles set welcome_email_sent_at = now() where welcome_email_sent_at is null;

-- Existing true values came from the old opt-out default. Reset them so future
-- lifecycle mail requires an explicit choice in Settings.
update public.profiles set lifecycle_emails = false where lifecycle_emails = true;

create or replace function public.enforce_plan_resource_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_status text;
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':' || tg_table_name, 0));

  select tier, subscription_status
    into v_tier, v_status
  from public.user_limits
  where user_id = new.user_id;

  if v_tier = 'pro' and v_status in ('active', 'trialing') then
    return new;
  end if;

  if tg_table_name = 'projects' then
    select count(*) into v_count from public.projects where user_id = new.user_id;
    if v_count >= 3 then raise exception 'Free plan project limit reached'; end if;
  elsif tg_table_name = 'flashcard_decks' then
    select count(*) into v_count from public.flashcard_decks where user_id = new.user_id;
    if v_count >= 5 then raise exception 'Free plan deck limit reached'; end if;
  end if;

  return new;
end;
$$;

drop trigger if exists projects_plan_limit on public.projects;
create trigger projects_plan_limit
  before insert on public.projects
  for each row execute function public.enforce_plan_resource_limits();

drop trigger if exists decks_plan_limit on public.flashcard_decks;
create trigger decks_plan_limit
  before insert on public.flashcard_decks
  for each row execute function public.enforce_plan_resource_limits();

create or replace function public.enforce_owned_references()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_project_id uuid := nullif(v_row->>'project_id', '')::uuid;
  v_deck_id uuid := nullif(v_row->>'deck_id', '')::uuid;
  v_thread_id uuid := nullif(v_row->>'thread_id', '')::uuid;
  v_file_id uuid := nullif(v_row->>'file_id', '')::uuid;
begin
  if v_project_id is not null
    and not exists (select 1 from public.projects where id = v_project_id and user_id = new.user_id)
  then raise exception 'Referenced project is not owned by user'; end if;

  if v_deck_id is not null
    and not exists (select 1 from public.flashcard_decks where id = v_deck_id and user_id = new.user_id)
  then raise exception 'Referenced deck is not owned by user'; end if;

  if v_thread_id is not null
    and not exists (select 1 from public.chat_threads where id = v_thread_id and user_id = new.user_id)
  then raise exception 'Referenced thread is not owned by user'; end if;

  if v_file_id is not null
    and not exists (select 1 from public.files where id = v_file_id and user_id = new.user_id)
  then raise exception 'Referenced file is not owned by user'; end if;

  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['notes', 'files', 'file_chunks', 'chat_threads', 'chat_messages', 'flashcard_decks', 'flashcards']
  loop
    execute format('drop trigger if exists owned_references on public.%I', t);
    execute format(
      'create trigger owned_references before insert or update on public.%I for each row execute function public.enforce_owned_references()',
      t
    );
  end loop;
end;
$$;

-- Save a study result and schedule the next review in one transaction.
create or replace function public.record_study_review(p_flashcard_id uuid, p_correct boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then return false; end if;

  perform 1
  from public.flashcards
  where id = p_flashcard_id and user_id = v_user
  for update;

  if not found then return false; end if;

  insert into public.study_reviews (flashcard_id, user_id, result)
  values (p_flashcard_id, v_user, case when p_correct then 'correct' else 'incorrect' end);

  update public.flashcards
  set due_at = now() + case when p_correct then interval '3 days' else interval '1 day' end
  where id = p_flashcard_id and user_id = v_user;

  return true;
end;
$$;

-- Trigger-only and event-trigger functions must not be callable through the API.
revoke all on function public.enforce_plan_resource_limits() from public, anon, authenticated;
revoke all on function public.enforce_owned_references() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_new_user_limits() from public, anon, authenticated;
revoke all on function public.block_placeholder_email_domains() from public, anon, authenticated;
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

revoke all on function public.reserve_ai_usage(text, text, integer) from public, anon;
grant execute on function public.reserve_ai_usage(text, text, integer) to authenticated;

revoke all on function public.record_study_review(uuid, boolean) from public, anon;
grant execute on function public.record_study_review(uuid, boolean) to authenticated;

alter function public.set_updated_at() set search_path = public;

create index if not exists chat_messages_user_id_idx on public.chat_messages(user_id);
create index if not exists chat_threads_project_id_idx on public.chat_threads(project_id);
create index if not exists file_chunk_embeddings_file_id_idx on public.file_chunk_embeddings(file_id);
create index if not exists file_chunk_embeddings_project_id_idx on public.file_chunk_embeddings(project_id);
create index if not exists file_chunks_file_id_idx on public.file_chunks(file_id);
create index if not exists file_chunks_project_id_idx on public.file_chunks(project_id);
create index if not exists files_project_id_idx on public.files(project_id);
create index if not exists flashcard_decks_project_id_idx on public.flashcard_decks(project_id);
create index if not exists flashcard_decks_user_id_idx on public.flashcard_decks(user_id);
