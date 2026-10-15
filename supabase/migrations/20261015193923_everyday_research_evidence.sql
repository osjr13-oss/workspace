-- Additive only. Older messages and existing ownership policies are unchanged.
alter table public.chat_messages add column if not exists research jsonb;
comment on column public.chat_messages.research is 'Optional research outcome, consulted public sources and material limitations. No private prompts or drafts.';
