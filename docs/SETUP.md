# Selrano setup guide

Production: **https://selrano.com**

---

## Step 1 — Database (Supabase)

1. Supabase → **SQL Editor** → paste all of `supabase/migrations/002_through_004_combined.sql` → **Run**.
2. If `vector` fails: **Database → Extensions** → enable **vector** → run again.

New tables include **`support_requests`** (every support form submission is stored here).

---

## Step 2 — Auth redirect URLs (Supabase)

**Authentication → URL Configuration**

- **Site URL:** `https://selrano.com`
- **Redirect URLs:**
  - `https://selrano.com/auth/callback`
  - `http://localhost:3000/auth/callback`

---

## Step 3 — Vercel environment variables

**Settings → Environment Variables → Production**

### Core (you should already have these)

| Name | Where to get it |
|------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same |
| `SUPABASE_SERVICE_ROLE_KEY` | Same (secret) |
| `GROQ_API_KEY` | console.groq.com |
| `GROQ_MODEL` | e.g. `llama-3.3-70b-versatile` |

### Add these

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_APP_URL` | `https://selrano.com` |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | `support@selrano.com` (shown on site; optional if you use default) |

Save → **Redeploy**.

---

## Step 4 — Resend (sending email) + where YOU read messages

You finished Resend through **4.3** (API key). Finish with the env vars below, then pick how you want to **read** support mail.

### 4.4 — Vercel (only 3 email variables)

| Name | What to put |
|------|-------------|
| `RESEND_API_KEY` | Your `re_...` key from Resend |
| `EMAIL_FROM` | `Selrano <noreply@selrano.com>` (domain must be verified in Resend) |
| `SUPPORT_INBOX` | **Your real inbox** — see below |

**Important:** `SUPPORT_INBOX` does **not** have to be `support@selrano.com`. It is only “where Resend forwards the alert when someone submits the form.” While you are setting up, use **your normal email** (e.g. `you@gmail.com`). You can switch to `support@selrano.com` later.

Redeploy after adding these.

---

### Where support messages show up (two places)

#### A) Supabase — always works, no inbox setup

Every submission is saved even if email fails.

1. [Supabase Dashboard](https://supabase.com/dashboard) → your project  
2. **Table Editor** → **`support_requests`**  
3. Each row has: `ticket_id`, `name`, `email`, `subject`, `message`, `created_at`

**Use this as your inbox today** if you have not configured `support@` yet. Sort by `created_at` descending.

#### B) Email — optional alert to your phone/desktop

When someone submits `/support`, Resend sends **you** one email (to `SUPPORT_INBOX`) with the full message. The user gets a confirmation email too.

To actually **read** those emails, `SUPPORT_INBOX` must be an address you already open (Gmail, Outlook, etc.) **or** you set up forwarding below.

---

### How to set up `support@selrano.com` (only if you want that address)

You only need this if you want a branded address instead of your personal Gmail in `SUPPORT_INBOX`.

**Option 1 — Free forwarding (domain on Cloudflare)**  
Best if `selrano.com` DNS is on Cloudflare:

1. Cloudflare → your domain → **Email** → **Email Routing**  
2. Create address `support@selrano.com` → forward to **your Gmail**  
3. Cloudflare will show DNS records to add (MX, etc.)  
4. In Vercel set `SUPPORT_INBOX=support@selrano.com` (mail arrives in Gmail via forward)

**Option 2 — Google Workspace (~$7/mo)**  
Real mailbox at Google:

1. [workspace.google.com](https://workspace.google.com) → add domain `selrano.com`  
2. Verify domain (TXT record at registrar)  
3. Create user **support@selrano.com**  
4. Log in at gmail.com with that account (or add to Gmail “Send mail as”)  
5. `SUPPORT_INBOX=support@selrano.com`

**Option 3 — Skip custom support@ for now (recommended)**  

- `SUPPORT_INBOX=your.personal@gmail.com`  
- `NEXT_PUBLIC_SUPPORT_EMAIL=support@selrano.com` (what users see on the site is fine; mail still goes to Gmail)  
- Read tickets in **Supabase** + Gmail alerts  

You do **not** need `hello@`, `security@`, or `privacy@` mailboxes. Legal pages all point to the same support address.

---

### 4.5 — Verify

1. Open `https://selrano.com/support` → submit a test message.  
2. **Supabase** → `support_requests` → new row.  
3. **Gmail** (or whatever you put in `SUPPORT_INBOX`) → email subject like `[Support] ...`.  
4. Optional: sign up → welcome email from `noreply@selrano.com`.

---

## Step 5 — Optional later

- **Supabase custom SMTP** — branded password-reset emails (Resend SMTP in Supabase auth settings).  
- **`EMBEDDING_API_KEY`** — smarter file search in project chat.  

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Form works but no email | Check `RESEND_API_KEY`, `EMAIL_FROM` domain verified, redeploy; still read Supabase table |
| No row in `support_requests` | Run Step 1 SQL |
| Emails go to wrong place | Change `SUPPORT_INBOX` in Vercel → redeploy |

```bash
npm run setup:check
```
