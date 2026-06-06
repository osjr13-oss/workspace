# Selrano operations playbook

Enterprise-grade operations checklist for email, branding, support, and trust — beyond application code.

## 1. Email infrastructure

### Transactional email (Resend)

The app sends branded email via [Resend](https://resend.com) when `RESEND_API_KEY` is set:

| Email | Trigger |
|-------|---------|
| Welcome | After signup (`/api/email/welcome`) |
| Support confirmation | User submits support form |
| Support notification | Inbox alert to `SUPPORT_INBOX` |
| Tips & reminders | Daily cron (`/api/cron/lifecycle-emails`) — see below |

**Vercel environment variables:**

```txt
RESEND_API_KEY=
EMAIL_FROM=Selrano <noreply@yourdomain.com>
SUPPORT_INBOX=support@yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
CRON_SECRET=          # random string; Vercel Cron sends Authorization: Bearer <CRON_SECRET>
```

### Lifecycle tips (cron)

Once per day (14:00 UTC), the app checks new users and sends **at most one** contextual tip email per person — only if they have not used a feature yet:

| Email key | When (days after signup) | Condition |
|-----------|--------------------------|-----------|
| `tip_projects` | 2–4 | No projects |
| `tip_chat` | 3–6 | No chat threads |
| `tip_upload` | 4–8 | No files |
| `tip_flashcards` | 7–14 | No flashcard decks |
| `tip_study` | 10–21 | Has decks, no study reviews |
| `nudge_inactive` | 14–90 | No AI usage in last 7 days |

Users can opt out in **Settings → Email preferences**. Each campaign is logged in `lifecycle_email_log` so nobody gets the same tip twice.

**Setup:**

1. Run migration `006_lifecycle_emails.sql` in Supabase.
2. Add `CRON_SECRET` in Vercel (generate a long random string).
3. Deploy — `vercel.json` registers the cron job automatically on Vercel.

Templates: [`lib/email/lifecycle-templates.ts`](../lib/email/lifecycle-templates.ts). Logic: [`lib/lifecycle-emails.ts`](../lib/lifecycle-emails.ts).

**Resend setup:**

1. Add and verify your domain in Resend.
2. Configure SPF, DKIM, and DMARC DNS records (Resend provides values).
3. Set `EMAIL_FROM` to an address on that domain (e.g. `noreply@yourdomain.com`).
4. Set `SUPPORT_INBOX` to the mailbox your team monitors.

### Auth emails (Supabase)

Password reset and signup confirmation still flow through **Supabase Auth**. For Fortune-500-grade deliverability:

1. Supabase Dashboard → **Authentication → SMTP Settings** → enable custom SMTP (Resend SMTP, Postmark, or SendGrid).
2. Match sender domain to `EMAIL_FROM`.
3. Customize templates under **Authentication → Email Templates** with Selrano logo, colors (`#f7f5f0`, `#15181f`), and support footer linking to `/support`.

## 2. Branding

Central config: [`lib/brand.ts`](../lib/brand.ts)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Canonical site URL (OG tags, email links) |
| `NEXT_PUBLIC_LEGAL_NAME` | Footer / legal entity name |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Public contact (legal + support pages) |
| `SUPPORT_INBOX` | Where Resend delivers support alerts (can be personal Gmail) |
| `NEXT_PUBLIC_STATUS_URL` | Optional status page (e.g. Instatus, Better Stack) |
| `NEXT_PUBLIC_DOCS_URL` | Optional external docs |

Email HTML: shared layout [`lib/email/layout.ts`](../lib/email/layout.ts); transactional [`lib/email/templates.ts`](../lib/email/templates.ts); lifecycle tips [`lib/email/lifecycle-templates.ts`](../lib/email/lifecycle-templates.ts)

## 3. Support operations

### In-app & public

- **`/support`** — public help center + contact form
- **`/help`** — authenticated help (prefilled contact form)
- **`support_requests`** table — ticket log (migration `004_ops_support.sql`)

Ticket IDs: `SRN-YYYYMMDD-XXXXXX`

### SLA (configured in brand)

Default copy: **1 business day**, Mon–Fri 9–17 US Eastern. Adjust in `lib/brand.ts` when you hire support staff.

### Recommended next steps

- Connect `SUPPORT_INBOX` to a shared inbox (Google Group, Zendesk, Intercom, Plain).
- Weekly export of `support_requests` where `status = 'open'`.
- Document internal runbooks for account recovery and data deletion (GDPR/CCPA).

## 4. Security & trust

- **`/security`** — public security overview
- **`audit_logs`** — account delete, support submit, welcome email (migration 004)
- Security contact: `security@` (see brand config)

### Enterprise checklist

- [ ] Custom SMTP for Supabase auth emails
- [ ] Resend domain verified (SPF/DKIM/DMARC)
- [ ] `NEXT_PUBLIC_APP_URL` set to production domain
- [ ] Supabase redirect URLs include `/auth/callback`
- [ ] Run migrations 001–006 in production
- [ ] `CRON_SECRET` set for lifecycle tip emails
- [ ] Optional: public status page (`NEXT_PUBLIC_STATUS_URL`)
- [ ] Optional: SOC 2 / penetration test vendor
- [ ] Bug bounty or responsible disclosure policy (email `security@`)

## 5. Database migrations (run in order)

1. `001_initial_schema.sql`
2. `002_ai_embeddings.sql`
3. `003_usage_limits.sql`
4. `004_ops_support.sql`
5. `005_billing.sql`
6. `006_lifecycle_emails.sql`
7. `007_pro_waitlist.sql`

### Pro waitlist

- Public page: **`/pro/waitlist`**
- Signups stored in **`pro_waitlist`** (Supabase Table Editor)
- CSV export (set `WAITLIST_EXPORT_SECRET` in Vercel):

```bash
curl -H "Authorization: Bearer YOUR_SECRET" https://selrano.com/api/waitlist/export -o waitlist.csv
```

## 6. What large companies add later

Not implemented yet — plan when you scale:

| Capability | Typical tool |
|------------|--------------|
| CRM / sales | HubSpot, Salesforce |
| Billing | Stripe + Customer Portal |
| Status page | Better Stack, Instatus |
| Analytics | PostHog, Amplitude |
| Error tracking | Sentry |
| SIEM / audit export | Datadog, Splunk |
| SSO / SAML | Supabase Enterprise, WorkOS |
| DPA / BAA | Legal + vendor agreements |

The codebase foundation (brand config, Resend, support tickets, audit log, trust pages) is designed so these plug in without rewrites.
