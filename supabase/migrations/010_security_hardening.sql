-- Moves security-sensitive writes behind server routes and makes AI quota
-- reservation atomic.
drop policy if exists "support_requests insert authenticated" on public.support_requests;
drop policy if exists "support_requests insert anon" on public.support_requests;
revoke insert on public.support_requests from anon, authenticated;
drop policy if exists "audit_logs insert own" on public.audit_logs;
revoke insert on public.audit_logs from anon, authenticated;
drop policy if exists "pro_waitlist insert authenticated" on public.pro_waitlist;
drop policy if exists "pro_waitlist insert anon" on public.pro_waitlist;
revoke insert on public.pro_waitlist from anon, authenticated;
drop policy if exists "workspace files insert own" on storage.objects;
drop policy if exists "workspace files update own" on storage.objects;

create or replace function public.reserve_ai_usage(p_route text default 'ai')
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_limit integer := 20; v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || tg_table_name,0));
  if v_user is null then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || current_date::text, 0));
  select case when tier='pro' and subscription_status in ('active','trialing') then 500 else 20 end
    into v_limit from public.user_limits where user_id=v_user;
  select count(*) into v_count from public.ai_usage_events
    where user_id=v_user and created_at >= date_trunc('day', now() at time zone 'utc');
  if v_count >= coalesce(v_limit,20) then return false; end if;
  insert into public.ai_usage_events(user_id,route) values(v_user,left(p_route,80));
  return true;
end $$;
grant execute on function public.reserve_ai_usage(text) to authenticated;

create table if not exists public.request_rate_limits(
  scope text not null, key_hash text not null, window_start timestamptz not null,
  request_count integer not null default 1, primary key(scope,key_hash)
);
alter table public.request_rate_limits enable row level security;
revoke all on public.request_rate_limits from anon,authenticated;
create or replace function public.check_rate_limit(p_scope text,p_key text,p_limit integer,p_window_seconds integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_hash text:=encode(digest(p_key,'sha256'),'hex'); v_count integer;
begin
  insert into public.request_rate_limits(scope,key_hash,window_start,request_count)
  values(left(p_scope,80),v_hash,now(),1)
  on conflict(scope,key_hash) do update set
    window_start=case when request_rate_limits.window_start < now()-make_interval(secs=>p_window_seconds) then now() else request_rate_limits.window_start end,
    request_count=case when request_rate_limits.window_start < now()-make_interval(secs=>p_window_seconds) then 1 else request_rate_limits.request_count+1 end
  returning request_count into v_count;
  return v_count <= p_limit;
end $$;
revoke all on function public.check_rate_limit(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.check_rate_limit(text,text,integer,integer) to service_role;

create or replace function public.enforce_plan_resource_limits()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_tier text; v_status text; v_count integer;
begin
  select tier,subscription_status into v_tier,v_status from public.user_limits where user_id=new.user_id;
  if v_tier='pro' and v_status in ('active','trialing') then return new; end if;
  if tg_table_name='projects' then
    select count(*) into v_count from public.projects where user_id=new.user_id;
    if v_count >= 3 then raise exception 'Free plan project limit reached'; end if;
  elsif tg_table_name='flashcard_decks' then
    select count(*) into v_count from public.flashcard_decks where user_id=new.user_id;
    if v_count >= 5 then raise exception 'Free plan deck limit reached'; end if;
  end if;
  return new;
end $$;
drop trigger if exists projects_plan_limit on public.projects;
create trigger projects_plan_limit before insert on public.projects for each row execute function public.enforce_plan_resource_limits();
drop trigger if exists decks_plan_limit on public.flashcard_decks;
create trigger decks_plan_limit before insert on public.flashcard_decks for each row execute function public.enforce_plan_resource_limits();

create or replace function public.enforce_owned_references()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_row jsonb := to_jsonb(new);
  v_project_id uuid := nullif(v_row->>'project_id','')::uuid;
  v_deck_id uuid := nullif(v_row->>'deck_id','')::uuid;
  v_thread_id uuid := nullif(v_row->>'thread_id','')::uuid;
  v_file_id uuid := nullif(v_row->>'file_id','')::uuid;
begin
  if v_project_id is not null
    and not exists(select 1 from public.projects where id=v_project_id and user_id=new.user_id)
  then raise exception 'Referenced project is not owned by user'; end if;
  if v_deck_id is not null and not exists(select 1 from public.flashcard_decks where id=v_deck_id and user_id=new.user_id)
  then raise exception 'Referenced deck is not owned by user'; end if;
  if v_thread_id is not null and not exists(select 1 from public.chat_threads where id=v_thread_id and user_id=new.user_id)
  then raise exception 'Referenced thread is not owned by user'; end if;
  if v_file_id is not null and not exists(select 1 from public.files where id=v_file_id and user_id=new.user_id)
  then raise exception 'Referenced file is not owned by user'; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['notes','files','file_chunks','chat_threads','chat_messages','flashcard_decks','flashcards']
  loop
    execute format('drop trigger if exists owned_references on public.%I',t);
    execute format('create trigger owned_references before insert or update on public.%I for each row execute function public.enforce_owned_references()',t);
  end loop;
end $$;
