# Live database schema

Project ref: `ucuppqutbzbwekyxrkwr` (Supabase project name: "meridian workspace")
Captured: 2026-08-08

## Why this file exists

Production has received schema changes outside tracked migration history. The
`supabase/migrations/` directory contains 21 files; production's tracked
migration history contains **four**. The migrations directory therefore does not
describe the live database, and replaying it would be actively harmful.

This file is the source of truth for what is actually deployed. Regenerate and
commit it after any schema change so drift shows up as a reviewable diff.

**Never run `supabase db push`.** Compare against this file first, then write a
focused idempotent migration.

## How to regenerate

The Supabase CLI is installed but this project is not linked, and linking needs
the database password. Until it is linked, regenerate by running the
introspection queries against the project (Supabase SQL editor, or an agent with
Supabase MCP access) and rewriting this file. The queries cover, per table:
columns from `information_schema.columns`, constraints from `pg_constraint`,
indexes from `pg_indexes`, policies from `pg_policy`, plus `pg_proc` for
functions and `supabase_migrations.schema_migrations` for tracked history.

Linking the project (`supabase link`) would make `supabase db dump` the better
mechanism. That is worth doing.

## Tracked migration history (production)

Only these four migrations are recorded in `supabase_migrations.schema_migrations`:

| version | name |
| --- | --- |
| 20260706160103 | pro_waitlist_launch_email |
| 20260706163345 | restore_support_request_insert |
| 20260710214928 | reconcile_launch_contracts |
| 20260711001827 | restore_service_role_table_grants |

Plus, applied 2026-08-08 during this cleanup:

| version | name |
| --- | --- |
| (2026-08-08) | restore_request_rate_limits |
| (2026-08-08) | adopt_background_job_tables |
| (2026-08-08) | release_stale_background_jobs |

Everything else in `supabase/migrations/` was applied by other means, partially,
or not at all.

## Known drift: repo vs production

Tables and columns that exist in production but appear in **no** repo migration:

| Object | Notes |
| --- | --- |
| `background_jobs` | Full job queue. Unused (0 rows), no code references. |
| `job_runs` | Per-attempt run log. Unused. |
| `ai_request_logs` | Per-request AI logging, FK to `background_jobs`. Unused. |
| `automation_events` | Workspace event log. Unused. |
| `project_summaries` | Cached project summaries. Unused. |
| `claim_background_jobs()` | Job-claiming RPC. Never executed in production. |
| `files.analysis_summary` | Column. Unused by code. |
| `files.key_concepts` | Column. Unused by code. |
| `files.likely_topics` | Column. Unused by code. |
| `files.suggested_flashcards` | Column. Unused by code. |
| `files.extraction_status` | Check constraint gained a `'processing'` value. |

These are the remains of an abandoned background-processing feature, most likely
inherited from the product this codebase was imported from. As of 2026-08-08 the
five tables and the RPC are adopted into tracked history by
`20260808130000_adopt_background_job_tables.sql` and will be built on by the
Worker. The four `files` columns remain unadopted and unused.

Defined in repo migrations but **missing** from production until 2026-08-08:

| Object | Notes |
| --- | --- |
| `request_rate_limits` | From `010_security_hardening.sql`, never applied. Restored 2026-08-08. |
| `check_rate_limit()` | Same. Its absence broke the support form. Restored 2026-08-08. |

## Extensions

| name | schema |
| --- | --- |
| pg_stat_statements | extensions |
| pgcrypto | extensions |
| plpgsql | pg_catalog |
| supabase_vault | vault |
| uuid-ossp | extensions |
| vector | public |

Note: `pgcrypto` is in `extensions`, not `public`. Any `security definer`
function using `digest()`/`crypt()` must include `extensions` in its
`search_path` or the call will not resolve at runtime.

## Functions

Application functions (extension-owned functions omitted):

| name | args | security definer | execute granted to |
| --- | --- | --- | --- |
| `block_placeholder_email_domains` | | yes | trigger |
| `check_rate_limit` | p_scope text, p_key text, p_limit integer, p_window_seconds integer | yes | service_role |
| `claim_background_jobs` | p_worker_id text, p_limit integer | yes | service_role |
| `enforce_owned_references` | | yes | trigger |
| `enforce_plan_resource_limits` | | yes | trigger |
| `handle_new_user` | | yes | trigger |
| `handle_new_user_limits` | | yes | trigger |
| `match_file_chunks` | p_project_id uuid, p_query_embedding vector, p_match_count integer | yes | authenticated |
| `record_study_review` | p_flashcard_id uuid, p_correct boolean | yes | authenticated |
| `release_stale_background_jobs` | p_stale_after_seconds integer | yes | service_role |
| `reserve_ai_usage` | p_route text, p_model text, p_input_chars integer | yes | authenticated |
| `rls_auto_enable` | | yes | event trigger |
| `search_chunks_fts` | p_query text, p_project_id uuid, p_match_count integer | yes | authenticated |
| `set_updated_at` | | | trigger |

Note: `reserve_ai_usage` in production takes **three** arguments. The version in
`010_security_hardening.sql` takes one and contains a bug (it references
`new.user_id` outside a trigger context). Do not replay that file.

## Triggers

| table | trigger |
| --- | --- |
| `background_jobs` | `background_jobs_updated_at` BEFORE UPDATE → `set_updated_at()` |
| `project_summaries` | `project_summaries_updated_at` BEFORE UPDATE → `set_updated_at()` |
| `projects` | `projects_plan_limit` BEFORE INSERT → `enforce_plan_resource_limits()` |
| `flashcard_decks` | `decks_plan_limit` BEFORE INSERT → `enforce_plan_resource_limits()` |
| `notes`, `files`, `file_chunks`, `chat_threads`, `chat_messages`, `flashcard_decks`, `flashcards` | `owned_references` BEFORE INSERT OR UPDATE → `enforce_owned_references()` |

## Tables

Every table below has row level security **enabled**.

### ai_request_logs

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `user_id` | uuid | null | |
| `job_id` | uuid | null | |
| `route` | text | not null | |
| `provider` | text | not null | `'groq'::text` |
| `model` | text | null | |
| `input_chars` | integer | null | |
| `output_chars` | integer | null | |
| `latency_ms` | integer | null | |
| `success` | boolean | not null | `true` |
| `error_message` | text | null | |
| `metadata` | jsonb | not null | `'{}'::jsonb` |
| `created_at` | timestamptz | not null | `now()` |

Constraints: PK (id); FK job_id → background_jobs(id) ON DELETE SET NULL; FK user_id → auth.users(id) ON DELETE CASCADE.
Indexes: `(job_id, created_at DESC)`, `(user_id, created_at DESC)`.
Policies: `ai_request_logs select own` SELECT using `(select auth.uid()) = user_id`.

### ai_usage_events

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `user_id` | uuid | not null | |
| `route` | text | not null | |
| `model` | text | null | |
| `input_chars` | integer | not null | `0` |
| `created_at` | timestamptz | not null | `now()` |

Constraints: PK (id); FK user_id → auth.users(id) ON DELETE CASCADE.
Indexes: `(user_id, created_at DESC)`.
Policies: insert own; select own using `auth.uid() = user_id`.

### audit_logs

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `user_id` | uuid | null | |
| `action` | text | not null | |
| `metadata` | jsonb | not null | `'{}'::jsonb` |
| `ip_address` | text | null | |
| `created_at` | timestamptz | not null | `now()` |

Constraints: PK (id); FK user_id → auth.users(id) ON DELETE SET NULL.
Indexes: `(action, created_at DESC)`, `(user_id, created_at DESC)`.
Policies: insert own; select own.

### automation_events

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `user_id` | uuid | null | |
| `event_type` | text | not null | |
| `source` | text | not null | `'app'::text` |
| `subject_type` | text | null | |
| `subject_id` | uuid | null | |
| `payload` | jsonb | not null | `'{}'::jsonb` |
| `created_at` | timestamptz | not null | `now()` |

Constraints: PK (id); FK user_id → auth.users(id) ON DELETE CASCADE.
Indexes: `(subject_type, subject_id, created_at DESC)`, `(user_id, created_at DESC)`.
Policies: `automation_events select own` SELECT using `(select auth.uid()) = user_id`.

### background_jobs

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `user_id` | uuid | not null | |
| `job_type` | text | not null | |
| `status` | text | not null | `'queued'::text` |
| `priority` | integer | not null | `0` |
| `attempts` | integer | not null | `0` |
| `max_attempts` | integer | not null | `3` |
| `run_after` | timestamptz | not null | `now()` |
| `locked_at` | timestamptz | null | |
| `locked_by` | text | null | |
| `started_at` | timestamptz | null | |
| `completed_at` | timestamptz | null | |
| `last_error` | text | null | |
| `idempotency_key` | text | null | |
| `payload` | jsonb | not null | `'{}'::jsonb` |
| `result` | jsonb | not null | `'{}'::jsonb` |
| `created_at` | timestamptz | not null | `now()` |
| `updated_at` | timestamptz | not null | `now()` |

Constraints:
- PK (id); UNIQUE (idempotency_key); FK user_id → auth.users(id) ON DELETE CASCADE
- `background_jobs_job_type_check` CHECK job_type IN (`process_file`, `analyze_file`, `refresh_project_summary`, `generate_flashcards`)
- `background_jobs_status_check` CHECK status IN (`queued`, `processing`, `succeeded`, `failed`, `canceled`)

Indexes:
- `background_jobs_claim_idx (status, run_after, priority DESC, created_at) WHERE status = 'queued'` (partial, matches the claim predicate)
- `(job_type, status, created_at DESC)`, `(user_id, created_at DESC)`, UNIQUE (idempotency_key)

Policies: `background_jobs select own` SELECT using `(select auth.uid()) = user_id`. No write policies: all writes go through the service role.

**Phase 1 note:** the `job_type` check constraint will need extending for the
Worker's job types. Do that with an explicit migration; do not drop the
constraint.

### chat_messages

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `thread_id` | uuid | not null | |
| `user_id` | uuid | not null | |
| `role` | text | not null | |
| `content` | text | not null | |
| `created_at` | timestamptz | not null | `now()` |
| `citations` | jsonb | not null | `'[]'::jsonb` |

Constraints: PK (id); CHECK role IN (user, assistant, system); FK thread_id → chat_threads ON DELETE CASCADE; FK user_id → auth.users ON DELETE CASCADE.
Indexes: `(thread_id, created_at)`, `(user_id)`.
Policies: `chat_messages all own` ALL using `auth.uid() = user_id`.

### chat_threads

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `user_id` | uuid | not null | |
| `project_id` | uuid | null | |
| `title` | text | not null | `'New conversation'::text` |
| `created_at` | timestamptz | not null | `now()` |
| `updated_at` | timestamptz | not null | `now()` |

Constraints: PK (id); FK project_id → projects ON DELETE SET NULL; FK user_id → auth.users ON DELETE CASCADE.
Indexes: `(project_id)`, `(user_id, updated_at DESC)`.
Policies: `chat_threads all own` ALL.

### content_memories

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `user_id` | uuid | not null | |
| `content` | text | not null | |
| `importance` | double precision | not null | `0.5` |
| `created_at` | timestamptz | not null | `now()` |
| `last_accessed` | timestamptz | not null | `now()` |

Constraints: PK (id); FK user_id → auth.users ON DELETE CASCADE.
Indexes: `(user_id, importance DESC, last_accessed DESC)`.
Policies: select / insert / update / delete own.

### file_chunk_embeddings

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `user_id` | uuid | not null | |
| `file_id` | uuid | not null | |
| `chunk_id` | uuid | not null | |
| `project_id` | uuid | null | |
| `embedding` | vector | not null | |
| `model` | text | not null | |
| `created_at` | timestamptz | not null | `now()` |

Constraints: PK (id); UNIQUE (chunk_id); FKs to file_chunks, files, projects, auth.users.
Indexes: HNSW `(embedding vector_cosine_ops)`, `(file_id)`, `(project_id)`, `(user_id, project_id)`, UNIQUE (chunk_id).
Policies: `file_chunk_embeddings all own` ALL.

**Note: 0 rows.** No embeddings have ever been generated, so semantic retrieval
always falls through to full-text search in practice.

### file_chunks

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `user_id` | uuid | not null | |
| `file_id` | uuid | not null | |
| `project_id` | uuid | null | |
| `chunk_index` | integer | not null | |
| `content` | text | not null | |
| `created_at` | timestamptz | not null | `now()` |
| `content_tsv` | tsvector | null | |
| `page_number` | integer | null | |
| `char_start` | integer | null | |
| `char_end` | integer | null | |

Constraints: PK (id); FKs to files, projects, auth.users.
Indexes: GIN `(content_tsv)`, `(file_id)`, `(project_id)`, `(user_id, project_id, file_id, chunk_index)`.
Policies: `file_chunks all own` ALL.

### files

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `user_id` | uuid | not null | |
| `project_id` | uuid | null | |
| `name` | text | not null | |
| `storage_path` | text | not null | |
| `mime_type` | text | null | |
| `size_bytes` | bigint | null | |
| `extraction_status` | text | not null | `'pending'::text` |
| `extracted_text` | text | null | |
| `created_at` | timestamptz | not null | `now()` |
| `analysis_summary` | text | null | *(drift, unused)* |
| `key_concepts` | text[] | not null | `'{}'::text[]` *(drift, unused)* |
| `likely_topics` | text[] | not null | `'{}'::text[]` *(drift, unused)* |
| `suggested_flashcards` | jsonb | not null | `'[]'::jsonb` *(drift, unused)* |

Constraints: PK (id); CHECK extraction_status IN (pending, **processing**, ready, unsupported, failed); FKs to projects, auth.users.
Indexes: `(project_id)`, `(user_id, project_id, created_at DESC)`.
Policies: `files all own` ALL.

**No `updated_at` column.** Change detection for the Worker must use
`created_at` plus `extraction_status`.

### flashcard_decks

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `user_id` | uuid | not null | |
| `project_id` | uuid | null | |
| `name` | text | not null | |
| `created_at` | timestamptz | not null | `now()` |
| `updated_at` | timestamptz | not null | `now()` |
| `is_public` | boolean | not null | `false` |
| `share_slug` | text | null | |

Constraints: PK (id); FKs to projects, auth.users.
Indexes: `(is_public) WHERE is_public`, `(project_id)`, `(user_id)`, UNIQUE `(share_slug) WHERE share_slug IS NOT NULL`.
Policies: `flashcard_decks all own` ALL; `flashcard_decks public select` SELECT using `is_public = true`.

### flashcards

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `user_id` | uuid | not null | |
| `deck_id` | uuid | not null | |
| `project_id` | uuid | null | |
| `front` | text | not null | |
| `back` | text | not null | |
| `source_type` | text | null | |
| `source_id` | uuid | null | |
| `due_at` | timestamptz | null | |
| `created_at` | timestamptz | not null | `now()` |
| `updated_at` | timestamptz | not null | `now()` |

Constraints: PK (id); FK deck_id → flashcard_decks ON DELETE CASCADE; FKs to projects, auth.users.
Indexes: `(user_id, due_at)` only.
Policies: `flashcards all own` ALL; `flashcards public select` via the parent deck's `is_public`.

**Missing indexes:** no index on `deck_id` or `project_id` despite both being
foreign keys queried on hot paths. Flagged by the Supabase performance advisor.

`source_type` / `source_id` are the natural key for the Worker's "never act
twice on the same source material" rule.

### job_runs

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `job_id` | uuid | not null | |
| `user_id` | uuid | not null | |
| `attempt` | integer | not null | |
| `status` | text | not null | `'processing'::text` |
| `worker_id` | text | null | |
| `started_at` | timestamptz | not null | `now()` |
| `finished_at` | timestamptz | null | |
| `duration_ms` | integer | null | |
| `error_message` | text | null | |
| `result` | jsonb | not null | `'{}'::jsonb` |

Constraints: PK (id); CHECK status IN (processing, succeeded, failed); FK job_id → background_jobs ON DELETE CASCADE; FK user_id → auth.users ON DELETE CASCADE.
Indexes: `(job_id, started_at DESC)`.
Policies: `job_runs select own` SELECT using `(select auth.uid()) = user_id`.

### lifecycle_email_log

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `user_id` | uuid | not null | |
| `email_key` | text | not null | |
| `sent_at` | timestamptz | not null | `now()` |

Constraints: PK (id); **UNIQUE (user_id, email_key)**; FK user_id → auth.users ON DELETE CASCADE.
Indexes: `(user_id, sent_at DESC)`, UNIQUE (user_id, email_key).
Policies: select own.

The UNIQUE constraint is what makes the claim-before-send pattern work: the
insert is the claim, and deleting the row on send failure releases it. The
Worker reuses this pattern.

### notes

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `user_id` | uuid | not null | |
| `project_id` | uuid | null | |
| `title` | text | not null | `'Untitled note'::text` |
| `content` | text | not null | `''::text` |
| `created_at` | timestamptz | not null | `now()` |
| `updated_at` | timestamptz | not null | `now()` |

Constraints: PK (id); FKs to projects, auth.users.
Indexes: `(user_id, project_id, updated_at DESC)`.
Policies: `notes all own` ALL.

### pro_waitlist

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `email` | text | not null | |
| `user_id` | uuid | null | |
| `source` | text | not null | `'pro_waitlist'::text` |
| `ip_address` | text | null | |
| `created_at` | timestamptz | not null | `now()` |
| `pro_launch_emailed_at` | timestamptz | null | |

Constraints: PK (id); UNIQUE (email); FK user_id → auth.users ON DELETE SET NULL.
Indexes: `(created_at DESC)`, `(email)`, `(pro_launch_emailed_at, created_at)`, UNIQUE (email).
Policies: insert anon; insert authenticated.

### profiles

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | |
| `full_name` | text | null | |
| `created_at` | timestamptz | not null | `now()` |
| `updated_at` | timestamptz | not null | `now()` |
| `lifecycle_emails` | boolean | not null | `false` |
| `welcome_email_sent_at` | timestamptz | null | |

Constraints: PK (id); FK id → auth.users ON DELETE CASCADE.
Policies: select own; update own.

**No timezone column.** Per-user local-time scheduling would require adding one.

### project_summaries

| column | type | null | default |
| --- | --- | --- | --- |
| `project_id` | uuid | not null | |
| `user_id` | uuid | not null | |
| `summary` | text | not null | `''::text` |
| `key_concepts` | text[] | not null | `'{}'::text[]` |
| `source_counts` | jsonb | not null | `'{}'::jsonb` |
| `refreshed_at` | timestamptz | null | |
| `created_at` | timestamptz | not null | `now()` |
| `updated_at` | timestamptz | not null | `now()` |

Constraints: **PK (project_id)**; FK project_id → projects ON DELETE CASCADE; FK user_id → auth.users ON DELETE CASCADE.
Indexes: `(user_id, refreshed_at DESC)`.
Policies: `project_summaries select own` SELECT using `(select auth.uid()) = user_id`.

### projects

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `user_id` | uuid | not null | |
| `name` | text | not null | |
| `description` | text | null | |
| `created_at` | timestamptz | not null | `now()` |
| `updated_at` | timestamptz | not null | `now()` |

Constraints: PK (id); FK user_id → auth.users ON DELETE CASCADE.
Indexes: `(user_id, updated_at DESC)`.
Policies: `projects all own` ALL.
Trigger: `projects_plan_limit` enforces the free-plan project cap.

### referrals

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `referrer_id` | uuid | not null | |
| `referred_id` | uuid | not null | |
| `created_at` | timestamptz | not null | `now()` |

Constraints: PK (id); CHECK referrer_id <> referred_id; UNIQUE (referred_id); FKs to auth.users.
Indexes: `(referrer_id)`, UNIQUE (referred_id).
Policies: select own (as referrer).

### request_rate_limits

Restored 2026-08-08 by `20260808120000_restore_request_rate_limits.sql`.

| column | type | null | default |
| --- | --- | --- | --- |
| `scope` | text | not null | |
| `key_hash` | text | not null | |
| `window_start` | timestamptz | not null | |
| `request_count` | integer | not null | `1` |

Constraints: PK (scope, key_hash).
Policies: none. All access is through `check_rate_limit()` (service role only).

### study_reviews

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `user_id` | uuid | not null | |
| `flashcard_id` | uuid | not null | |
| `result` | text | not null | |
| `created_at` | timestamptz | not null | `now()` |

Constraints: PK (id); CHECK result IN (correct, incorrect); FKs to flashcards, auth.users.
Indexes: primary key only.
Policies: `study_reviews all own` ALL.

**Missing indexes:** no index on `user_id` or `flashcard_id` despite both being
foreign keys. Reviews are written on every study answer.

### style_profiles

| column | type | null | default |
| --- | --- | --- | --- |
| `user_id` | uuid | not null | |
| `dimensions` | jsonb | not null | `'{}'::jsonb` |
| `style_directive` | text | not null | `''::text` |
| `confidence` | double precision | not null | `0` |
| `message_count` | integer | not null | `0` |
| `updated_at` | timestamptz | not null | `now()` |

Constraints: PK (user_id); FK user_id → auth.users ON DELETE CASCADE.
Policies: view / insert / update own. **No delete policy.**

### support_requests

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | `gen_random_uuid()` |
| `ticket_id` | text | not null | |
| `user_id` | uuid | null | |
| `name` | text | not null | |
| `email` | text | not null | |
| `subject` | text | not null | |
| `message` | text | not null | |
| `status` | text | not null | `'open'::text` |
| `created_at` | timestamptz | not null | `now()` |
| `updated_at` | timestamptz | not null | `now()` |

Constraints: PK (id); UNIQUE (ticket_id); CHECK status IN (open, in_progress, resolved, closed); FK user_id → auth.users ON DELETE SET NULL.
Indexes: `(email, created_at DESC)`, `(status, created_at DESC)`, UNIQUE (ticket_id).
Policies: insert anon; insert authenticated; select own.

### user_limits

| column | type | null | default |
| --- | --- | --- | --- |
| `user_id` | uuid | not null | |
| `tier` | text | not null | `'free'::text` |
| `daily_requests` | integer | not null | `20` |
| `created_at` | timestamptz | not null | `now()` |
| `updated_at` | timestamptz | not null | `now()` |
| `stripe_customer_id` | text | null | |
| `stripe_subscription_id` | text | null | |
| `subscription_status` | text | not null | `'none'::text` |
| `current_period_end` | timestamptz | null | |
| `referral_code` | text | null | |
| `referral_bonus_active` | boolean | not null | `false` |
| `referral_bonus_until` | timestamptz | null | |

Constraints: PK (user_id); FK user_id → auth.users ON DELETE CASCADE.
Indexes: UNIQUE `(referral_code) WHERE referral_code IS NOT NULL`.
Policies: select own.

## Standing issues visible in this schema

1. **RLS policy performance.** The five worker tables use `(select auth.uid())`,
   which Postgres evaluates once per query. Every other table uses bare
   `auth.uid() = user_id`, which is re-evaluated per row. This is the Supabase
   performance advisor warning in the handoff backlog.
2. **Unindexed foreign keys** on `flashcards.deck_id`, `flashcards.project_id`,
   and `study_reviews` (both FKs).
3. **`file_chunk_embeddings` is empty**, so vector retrieval never actually runs.
4. **`files` has no `updated_at`.**
5. **`profiles` has no timezone column.**
