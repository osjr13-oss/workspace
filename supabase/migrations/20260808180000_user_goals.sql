-- User goals: what the person is working toward and when it is due.
--
-- The Worker reads these to decide urgency. A midterm nine days out should
-- raise the priority of material linked to that project; a goal with no
-- deadline should not. Version one is manual entry only, no calendar or LMS
-- integration.
--
-- Deliberately a plain date rather than a timestamptz: a deadline is a calendar
-- day to the user ("October 14"), and storing it as an instant would introduce
-- timezone drift the product does not otherwise have.

create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  deadline date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.user_goals add constraint user_goals_status_check
    check (status = any (array['active','done']));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.user_goals add constraint user_goals_title_not_blank
    check (length(btrim(title)) > 0);
exception when duplicate_object then null; end $$;

-- The Worker's per-run query is "active goals for this user, soonest deadline
-- first". Nulls sort last so undated goals do not crowd out urgent ones.
create index if not exists user_goals_user_status_deadline_idx
  on public.user_goals (user_id, status, deadline nulls last);

create index if not exists user_goals_project_idx
  on public.user_goals (project_id);

drop trigger if exists user_goals_updated_at on public.user_goals;
create trigger user_goals_updated_at
  before update on public.user_goals
  for each row execute function public.set_updated_at();

-- A goal may only reference a project the same user owns. This trigger already
-- guards the other project-linked tables.
drop trigger if exists owned_references on public.user_goals;
create trigger owned_references
  before insert or update on public.user_goals
  for each row execute function public.enforce_owned_references();

alter table public.user_goals enable row level security;

drop policy if exists "user_goals all own" on public.user_goals;
create policy "user_goals all own" on public.user_goals
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_goals to authenticated;
