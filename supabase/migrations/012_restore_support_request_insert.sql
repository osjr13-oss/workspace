drop policy if exists "support_requests insert authenticated" on public.support_requests;
drop policy if exists "support_requests insert anon" on public.support_requests;

create policy "support_requests insert authenticated" on public.support_requests
  for insert to authenticated
  with check ((select auth.uid()) = user_id or user_id is null);

create policy "support_requests insert anon" on public.support_requests
  for insert to anon
  with check (user_id is null);

grant insert on public.support_requests to anon, authenticated;
