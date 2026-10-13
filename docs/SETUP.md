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

## Step 3 - Vercel environment variables

**Settings -> Environment Variables -> Production**

### Core

| Name | Where to get it |
|------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase -> Settings -> API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same |
| `SUPABASE_SERVICE_ROLE_KEY` | Same (secret) |
| `GROQ_API_KEY` | console.groq.com (secret) |
| `NEXT_PUBLIC_APP_URL` | `https://selrano.com` |

### AI models (all optional)

Groq is the only AI provider. The defaults below work; set a variable only to change the model. Groq retires models from time to time, so check https://console.groq.com/docs/deprecations before choosing one. A value that points at a model Groq has already shut down is ignored and the default is used instead.

| Name | Default | Used for |
|------|---------|----------|
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Chat answers, flashcard generation, text transformations |
| `GROQ_FALLBACK_MODEL` | `openai/gpt-oss-20b` | Takes over at once when the main model is rate limited. Groq limits are per model, so keep it different from `GROQ_MODEL` |
| `GROQ_BACKGROUND_MODEL` | the fallback model | Memory extraction, kept off the main model's limit |
| `GROQ_VISION_MODEL` | `qwen/qwen3.8-27b` | Reading text in uploaded images |
| `TAVILY_API_KEY` | none | Live web search in chat. Without it the model cannot search the web |
| `EMBEDDING_API_KEY` | none | Smarter file search in project chat |

`ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` are no longer used and can be deleted. `SUPPORT_INBOX` and `NEXT_PUBLIC_SUPPORT_EMAIL` are no longer used either.

Save -> **Redeploy**. Vercel only applies changed variables to new deployments.

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
| The assistant never uses the web | `TAVILY_API_KEY` is missing |
| An uploaded image is rejected | Images must be under about 2.8 MB, in PNG, JPG, WebP, or GIF format |

```bash
npm run setup:check
```

To run the app against fake services instead (no accounts needed), see "Tests" in `docs/HANDOFF.md`.
