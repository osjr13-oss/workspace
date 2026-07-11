-- Restore the server-only role's access to every application table. Earlier
-- hardening revoked broad API-role privileges, but production never received
-- the follow-up service_role grants from migration 015. This broke server
-- routes for email preferences, welcome/audit logging, support, billing,
-- lifecycle email jobs, account deletion, and exports.

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- Preserve the same server trust boundary for future public tables/sequences.
alter default privileges in schema public grant all privileges on tables to service_role;
alter default privileges in schema public grant all privileges on sequences to service_role;
