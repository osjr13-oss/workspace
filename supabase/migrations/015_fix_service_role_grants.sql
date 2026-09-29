-- Migration 010 locked several tables down (revoked direct anon/authenticated
-- writes) to force sensitive writes through secure server-side code, but never
-- granted the needed access to service_role — the key that server-side "admin"
-- client actually uses. That silently broke:
--   - profiles: Settings > email preferences (PATCH /api/account/email-preferences)
--   - pro_waitlist: the waitlist CSV export tool
--   - audit_logs: every audit log write (support tickets, account deletion,
--     welcome emails) — logAudit() now always uses the service-role client (see
--     lib/audit.ts), so this grant is what makes those writes work again.
--
-- service_role already bypasses row-level security by design and is only ever
-- used server-side (the key never reaches the browser), so granting it full
-- access here just extends the same trust boundary that already applies —
-- mirroring the "grant all ... to anon, authenticated" done for those roles in
-- 001_initial_schema.sql.

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Also cover any tables created after this migration runs.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
