# Selrano setup guide

Your production domain: **https://selrano.com**

Work through these steps in order. Each step unlocks part of the app. You already have Supabase + Groq + Vercel working for the core app; this wires up everything we added later (auth callback, RAG, usage limits, email, support).

---

## Step 1 — Database (Supabase) ~10 min

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**.
2. Click **New query**.
3. Open this file in the repo and paste the entire contents:

   `supabase/migrations/002_through_004_combined.sql`

4. Click **Run**. You should see “Success” with no errors.

**Verify:** Table Editor should show new tables:

- `file_chunk_embeddings`
- `ai_usage_events`
- `user_limits`
- `support_requests`
- `audit_logs`

**If you get an error on `vector`:** Supabase → **Database → Extensions** → enable **vector** → run the script again.

---

## Step 2 — Auth redirect URLs (Supabase) ~3 min

1. Supabase → **Authentication** → **URL Configuration**.
2. Set **Site URL** to:

   ```txt
   https://selrano.com
   ```

3. Under **Redirect URLs**, add (one per line):

   ```txt
   https://selrano.com/auth/callback
   http://localhost:3000/auth/callback
   ```

4. Save.

**Verify:** Request password reset from `/reset-password` → email link should land on `/auth/update-password` after clicking (not a dead page).

---

## Step 3 — Vercel environment variables ~15 min

1. [Vercel Dashboard](https://vercel.com) → your **workspace** project → **Settings** → **Environment Variables**.
2. Add or update for **Production** (and **Preview** if you use preview deploys).

### Already required (you likely have these)

| Name | Example / notes |
|------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page (secret — never expose client-side) |
| `GROQ_API_KEY` | From [console.groq.com](https://console.groq.com) |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` |

### Branding (add these)

| Name | Value for you |
|------|----------------|
| `NEXT_PUBLIC_APP_URL` | `https://selrano.com` |
| `NEXT_PUBLIC_LEGAL_NAME` | `Selrano` |
| `NEXT_PUBLIC_HELLO_EMAIL` | `hello@selrano.com` |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | `support@selrano.com` |
| `NEXT_PUBLIC_SECURITY_EMAIL` | `security@selrano.com` |
| `NEXT_PUBLIC_PRIVACY_EMAIL` | `privacy@selrano.com` |

### Email — Resend (Step 4; add keys after Resend is ready)

| Name | Value for you |
|------|----------------|
| `RESEND_API_KEY` | `re_...` from Resend |
| `EMAIL_FROM` | `Selrano <noreply@selrano.com>` |
| `SUPPORT_INBOX` | `support@selrano.com` |

### Optional

| Name | When to add |
|------|-------------|
| `EMBEDDING_API_KEY` | OpenAI key for smarter project chat over files |
| `EMBEDDING_MODEL` | `text-embedding-3-small` |
| `AI_DAILY_LIMIT` | Default `100` if omitted |

3. **Redeploy** after saving env vars: Deployments → ⋯ on latest → **Redeploy** (env only applies on new builds).

**Local dev:** Copy `.env.example` → `.env.local`, fill the same values, use `http://localhost:3000` only where noted for redirects (not for `NEXT_PUBLIC_APP_URL` — keep production URL for email links or use localhost for local-only testing).

---

## Step 4 — Resend + DNS (selrano.com) ~30 min

1. Sign up at [resend.com](https://resend.com).
2. **Domains** → **Add Domain** → `selrano.com`.
3. Resend shows DNS records (SPF, DKIM, etc.). Add them at your domain registrar (where you bought selrano.com).
4. Wait until Resend shows the domain as **Verified** (often 5–30 minutes).
5. **API Keys** → Create key → copy `re_...`.
6. Put in Vercel:
   - `RESEND_API_KEY` = your key
   - `EMAIL_FROM` = `Selrano <noreply@selrano.com>`
   - `SUPPORT_INBOX` = `support@selrano.com`
7. Redeploy Vercel.

**Create inboxes at your email provider** (Google Workspace, Zoho, etc.):

- `support@selrano.com` — receives support form + replies
- `hello@`, `security@`, `privacy@` — forward to you or aliases

**Verify email works:**

1. Sign up a test account → should receive **Welcome** email.
2. Submit form at `https://selrano.com/support` → confirmation email + ticket in Supabase `support_requests`.

---

## Step 5 — Supabase auth emails (optional but recommended) ~20 min

Password-reset emails still come from Supabase until you customize SMTP.

1. Supabase → **Authentication** → **SMTP Settings** → enable custom SMTP.
2. Use Resend SMTP (Resend docs: host `smtp.resend.com`, port `465`, user `resend`, password = your API key).
3. Sender: `noreply@selrano.com`.
4. **Authentication** → **Email Templates** — add logo + link to `https://selrano.com/support` in footer.

---

## Step 6 — Semantic search (optional) ~5 min

Only if you want AI chat to pull the *most relevant* file chunks per project:

1. Create an [OpenAI API key](https://platform.openai.com/api-keys).
2. Vercel → `EMBEDDING_API_KEY` = that key.
3. Redeploy.
4. Re-upload a PDF on a project (embeddings generate on upload).

Without this key, chat still works using notes + sequential file excerpts.

---

## Step 7 — Check everything

```bash
# After .env.local exists (optional)
npm run setup:check
```

| Test | Expected |
|------|----------|
| Visit `/support`, submit form | Success message + row in `support_requests` |
| Sign up | Welcome email (if Resend configured) |
| Reset password | Lands on `/auth/update-password` |
| Project chat with uploaded PDF | Works; better with `EMBEDDING_API_KEY` |
| 100+ AI messages same day | 429 with daily limit message |

---

## Quick troubleshooting

| Symptom | Fix |
|---------|-----|
| Support form 500 / permission denied | Run Step 1 SQL migration |
| Password reset link goes nowhere | Step 2 redirect URLs |
| No welcome / support emails | Step 4 Resend + redeploy |
| Chat works but “dumb” file context | Step 6 embedding key + re-upload files |
| `AI_DAILY_LIMIT` errors immediately | Run migration 003; table `ai_usage_events` must exist |

---

## What you can skip for now

- `NEXT_PUBLIC_STATUS_URL` — add when you have a status page
- `EMBEDDING_*` — add when you want RAG
- Custom Supabase SMTP — auth emails still work on Supabase default until Step 5

For ongoing ops (SLAs, enterprise checklist): [OPERATIONS.md](./OPERATIONS.md).
