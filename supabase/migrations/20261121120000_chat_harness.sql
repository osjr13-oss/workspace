-- Chat that keeps every version, remembers long conversations, and knows the
-- owner's instructions (owner request 2026-11-21: compete with ChatGPT and
-- Claude). Additive and idempotent: it adds columns, one table, indexes and
-- triggers, and fills the new parent links from the existing message order.
-- It deletes nothing. Safe to run more than once.

-- Messages form a tree: an edited question or a retried answer becomes a
-- sibling instead of replacing what came after it.
alter table public.chat_messages add column if not exists parent_id uuid references public.chat_messages(id) on delete cascade;
-- What the reply looked up (emails, events, transactions, notes), so a
-- follow-up such as "reply to that email" works without searching again.
alter table public.chat_messages add column if not exists tool_trace jsonb;
-- Suggested next questions shown under the reply.
alter table public.chat_messages add column if not exists suggestions jsonb;
-- Thumbs up (1) or down (-1), with an optional reason.
alter table public.chat_messages add column if not exists feedback smallint check (feedback in (-1, 1));
alter table public.chat_messages add column if not exists feedback_reason text;
create index if not exists chat_messages_parent_idx on public.chat_messages (parent_id);

-- Search across everything said in chat.
alter table public.chat_messages add column if not exists content_tsv tsvector
  generated always as (to_tsvector('english', coalesce(content, ''))) stored;
create index if not exists chat_messages_content_tsv_idx on public.chat_messages using gin (content_tsv);

-- Which version of the conversation is showing, a running summary of the
-- older part of a long chat, whether the title was set by hand, and whether
-- the chat is temporary (kept out of history and memory, removed after a day).
alter table public.chat_threads add column if not exists active_leaf_id uuid references public.chat_messages(id) on delete set null;
alter table public.chat_threads add column if not exists summary text;
alter table public.chat_threads add column if not exists summary_through timestamptz;
alter table public.chat_threads add column if not exists title_locked boolean not null default false;
alter table public.chat_threads add column if not exists temporary boolean not null default false;

-- A message's parent must be in the same conversation.
create or replace function public.chat_message_parent_same_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.chat_messages p where p.id = new.parent_id and p.thread_id = new.thread_id and p.user_id = new.user_id
  ) then
    raise exception 'parent message must belong to the same conversation';
  end if;
  return new;
end;
$$;
drop trigger if exists chat_message_parent_same_thread on public.chat_messages;
create trigger chat_message_parent_same_thread
  before insert or update of parent_id on public.chat_messages
  for each row execute function public.chat_message_parent_same_thread();

-- The shown version must be a message of the same conversation.
create or replace function public.chat_thread_leaf_same_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.active_leaf_id is not null and not exists (
    select 1 from public.chat_messages m where m.id = new.active_leaf_id and m.thread_id = new.id and m.user_id = new.user_id
  ) then
    raise exception 'active message must belong to the same conversation';
  end if;
  return new;
end;
$$;
drop trigger if exists chat_thread_leaf_same_thread on public.chat_threads;
create trigger chat_thread_leaf_same_thread
  before insert or update of active_leaf_id on public.chat_threads
  for each row execute function public.chat_thread_leaf_same_thread();

-- Existing conversations are one straight line: each message's parent is the
-- one before it, and the newest message is the one showing.
with ordered as (
  select id, lag(id) over (partition by thread_id order by created_at, id) as previous
  from public.chat_messages
)
update public.chat_messages m
set parent_id = ordered.previous
from ordered
where m.id = ordered.id and m.parent_id is null and ordered.previous is not null;

update public.chat_threads t
set active_leaf_id = latest.id
from (
  select distinct on (thread_id) thread_id, id
  from public.chat_messages
  order by thread_id, created_at desc, id desc
) latest
where t.id = latest.thread_id and t.active_leaf_id is null;

-- Custom instructions: what Selrano should know about the owner and how to answer.
alter table public.profiles add column if not exists about_you text;
alter table public.profiles add column if not exists response_instructions text;
alter table public.profiles add column if not exists response_style text not null default 'normal';

-- Per-project instructions.
alter table public.projects add column if not exists instructions text;

-- Scheduled asks, such as a weekday morning brief. Run by the Worker's cron.
create table if not exists public.scheduled_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  prompt text not null,
  cadence text not null check (cadence in ('daily', 'weekdays', 'weekly')),
  weekday smallint check (weekday between 0 and 6),
  hour smallint not null check (hour between 0 and 23),
  minute smallint not null default 0 check (minute between 0 and 59),
  enabled boolean not null default true,
  last_run_at timestamptz,
  last_thread_id uuid references public.chat_threads(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists scheduled_prompts_user_idx on public.scheduled_prompts (user_id);
alter table public.scheduled_prompts enable row level security;
drop policy if exists "scheduled_prompts all own" on public.scheduled_prompts;
create policy "scheduled_prompts all own" on public.scheduled_prompts
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.scheduled_prompts to authenticated;
grant all on public.scheduled_prompts to service_role;
