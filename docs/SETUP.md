# Selrano setup guide

Production: **https://selrano.com**

---

## Step 1 - Database (Supabase)

For an existing environment, apply new migrations through a tracked migration workflow. Do not paste only the combined early migration into production; later migrations contain required billing, security, quota, and data-integrity fixes.

For a brand-new database:

1. Run `001_initial_schema.sql`.
2. Run either `002_through_004_combined.sql` **or** the separate `002_ai_embeddings.sql`, `003_usage_limits.sql`, and `004_ops_support.sql` files. Do not run both paths.
3. Run every later migration in version order, including the timestamped reconciliation migrations.
4. If `vector` fails: **Database -> Extensions** -> enable **vector** -> run the migration again.

Before every deployment, confirm the production migration history matches the repository. A successful Next.js build does not verify the live database schema.

The `support_requests` table still exists from earlier versions, but nothing writes to it any more: the support form was removed on 2026-10-08.

---

## Step 2 - Auth redirect URLs (Supabase)

**Authentication -> URL Configuration**

- **Site URL:** `https://selrano.com`
- **Redirect URLs:**
  - `https://selrano.com/auth/callback`
  - `http://localhost:3000/auth/callback`

---

## Step 3 - Cloudflare Worker settings

Open **Workers & Pages > selrano > Settings > Variables and Secrets**. Store private keys as secrets. Provide the public build settings listed in [Cloudflare hosting](CLOUDFLARE.md).

### Core

| Name | Where to get it |
|------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase -> Settings -> API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same |
| `SUPABASE_SERVICE_ROLE_KEY` | Same (secret) |
| `GROQ_API_KEY` | console.groq.com (secret; fallback and non-chat work) |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys (server-only Secret; primary chat) |
| `NEXT_PUBLIC_APP_URL` | `https://selrano.com` |

### AI models (all optional)

OpenAI GPT is primary for chat when `OPENAI_API_KEY` is set; Groq takes over if OpenAI is unavailable before output. Without that key, chat continues on Groq. Background work (memory extraction) remains on Groq. Requests use `store: false`, so OpenAI does not keep conversation state. The defaults below work; set a variable only to change the model. Groq retires models from time to time, so check https://console.groq.com/docs/deprecations before choosing one. A value that points at a model Groq has already shut down is ignored and the default is used instead.

| Name | Default | Used for |
|------|---------|----------|
| `OPENAI_MODEL` | `gpt-6.1-sol` | Primary chat model. `gpt-6-luna` is far cheaper; `gpt-6-astra` is the flagship |
| `OPENAI_REASONING_EFFORT` | model default | Optional reasoning effort, for example `low` for faster first words |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Fallback chat answers |
| `GROQ_FALLBACK_MODEL` | `openai/gpt-oss-20b` | Takes over at once when the main model is rate limited. Groq limits are per model, so keep it different from `GROQ_MODEL` |
| `GROQ_REASONING_EFFORT` | `medium` | How hard chat answers think on gpt-oss models (`low`, `medium`, `high`). Higher is smarter on hard questions but slower to start. Background work always uses `low` |
| `GROQ_BACKGROUND_MODEL` | the fallback model | Memory extraction, kept off the main model's limit |
| `GROQ_VISION_MODEL` | `qwen/qwen3.8-27b` | Reading text in uploaded images |
| `EXA_API_KEY` | none | Server-only key from the [Exa dashboard](https://dashboard.exa.ai/api-keys) for web search and reading source pages |

`SUPPORT_INBOX` and `NEXT_PUBLIC_SUPPORT_EMAIL` are no longer used either.

`OPENAI_BASE_URL` and `EXA_BASE_URL` are for offline tests. Leave both unset on the production Worker. Save the settings and deploy.

---

## Step 4 - Resend (sending email)

Resend sends the welcome email and the optional tips and weekly check-ins. There is no support inbox.

| Name | What to put |
|------|-------------|
| `RESEND_API_KEY` | Your `re_...` key from Resend |
| `EMAIL_FROM` | `Selrano <noreply@selrano.com>` (the domain must be verified in Resend) |
| `CRON_SECRET` | A long random string; the daily lifecycle email job checks it |

Redeploy after adding these, then check it works: sign up with a new account and look for the welcome email from `noreply@selrano.com`.

---

## Step 4b - Gmail and Google Calendar (optional)

Lets the owner connect Google in **Settings > Connected accounts**. Selrano reads mail and the calendar, saves drafts (never sends) and adds events the owner confirms. No Google verification is needed for a personal app; the owner clicks through Google's "unverified app" screen once.

1. At **console.cloud.google.com**, create a project (for example "Selrano").
2. **APIs & Services > Library**: enable **Gmail API** and **Google Calendar API**.
3. **Google Auth Platform** (OAuth consent screen): choose **External**, app name Selrano, the owner's email for support and developer contact. Under **Data Access**, add the scopes `gmail.readonly`, `gmail.compose` and `calendar.events`. Under **Audience**, click **Publish app** so it is "In production" (apps left in Testing lose access every 7 days).
4. **Clients > Create client**: type **Web application**, authorized redirect URI `https://www.selrano.com/api/integrations/google/callback`.
5. Copy the client ID and secret into the Worker as secrets `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (**Workers & Pages > selrano > Settings > Variables and Secrets**).
6. Apply `supabase/migrations/20261120000000_google_connections.sql` in the Supabase SQL Editor.

## Step 4c - Personal finance with Plaid (optional)

Powers the Money page and money questions in chat. Read-only: only the Transactions product is requested. Plaid's free Trial plan allows 10 bank logins (Items) for life; removing one does not free its slot, so test in sandbox first.

1. Create an account at **dashboard.plaid.com** and verify the email.
2. Apply for the **Trial plan** (Dashboard home, or dashboard.plaid.com/trial-plan). On a Trial, OAuth banks such as Chase need no company profile or security questionnaire.
3. **Developers > Keys**: copy the client ID and the **Sandbox** secret.
4. Worker secrets (**Workers & Pages > selrano > Settings > Variables and Secrets**): `PLAID_CLIENT_ID`, `PLAID_SECRET`, and `PLAID_ENV` = `sandbox`. Connect Plaid's test bank on the Money page (user `user_good`, password `pass_good`) to confirm the flow.
5. Apply `supabase/migrations/20261120120000_plaid_finance.sql` in the Supabase SQL Editor.
6. To go live: disconnect the test bank, set `PLAID_SECRET` to the **Production** secret and `PLAID_ENV` to `production`, then connect real banks. Sandbox and production data are kept apart by `plaid_items.environment`.

## Step 4d - Dedicated lock for connected-account logins (recommended)

Your Google and bank logins are encrypted before they are stored. By default the lock is made from `SUPABASE_SERVICE_ROLE_KEY`, so replacing that Supabase key would make them unreadable (and a bank reconnect spends one of the 10 lifetime Plaid Trial slots). This step gives the lock its own key so replacing the Supabase key is safe.

1. In your password manager (Apple Passwords, 1Password and similar), create a new entry named "Selrano token key" with a generated random password of **at least 48 characters**. Keep that entry forever: if this key is lost, the stored logins cannot be opened and you would reconnect Google and your banks.
2. Cloudflare: **Workers & Pages > selrano > Settings > Variables and Secrets > Add**. Type **Secret**, name `TOKEN_ENCRYPTION_KEY`, value is the password from step 1. Save and deploy.
3. Nothing else to do. New logins use it at once. Old ones are re-locked automatically by the daily 12:00 UTC bank job (`/api/cron/plaid-sync`), which checks each re-locked value before saving it. In Worker logs, look for `[cron/plaid-sync] stored logins` with `upgraded` above 0 after the first run.
4. Only after that log line appears is it safe to ever replace the Supabase service key.

## Step 5 - Optional later

- **Supabase custom SMTP** - branded password-reset emails (Resend SMTP in Supabase auth settings). See `docs/OPERATIONS.md`.
- **A public contact channel** - the Privacy, Terms, and Security pages currently say none is offered. See `docs/HANDOFF.md`, "Support and contact".

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| No welcome email | Check `RESEND_API_KEY`, that the `EMAIL_FROM` domain is verified in Resend, and redeploy |
| Chat says the AI is handling a lot of requests | Groq is rate limiting both the main and fallback model. Wait a few seconds and send again; failed turns are not counted against the daily limit |
| Chat fails for every message | Check `GROQ_API_KEY`, and that `GROQ_MODEL` (if set) is a model Groq still offers |
| The assistant never uses the web | `EXA_API_KEY` is missing |
| An uploaded image is rejected | Images must be under about 2.8 MB, in PNG, JPG, WebP, or GIF format |

```bash
npm run setup:check
```

To run the app against fake services instead (no accounts needed), see "Tests" in `docs/HANDOFF.md`.
