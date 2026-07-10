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
| Tips & reminders | Optional lifecycle cron (`/api/cron/lifecycle-emails`) — see below |

**Vercel environment variables:**

```txt
RESEND_API_KEY=
EMAIL_FROM=Selrano <noreply@yourdomain.com>
SUPPORT_INBOX=support@yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
CRON_SECRET=          # random string; Vercel Cron sends Authorization: Bearer <CRON_SECRET>
```

### Lifecycle tips (cron)

Once per day (14:00 UTC), the app checks opted-in users and sends **at most one** contextual tip email per person per 7 days — only if they have not used a feature yet:

| Email key | When (days after signup) | Condition |
|-----------|--------------------------|-----------|
| `tip_projects` | 2–4 | No projects |
| `tip_chat` | 3–6 | No chat threads |
| `tip_upload` | 4–8 | No files |
| `tip_flashcards` | 7–14 | No flashcard decks |
| `tip_study` | 10–21 | Has decks, no study reviews |
| `nudge_inactive` | 14–90 | No AI usage in last 7 days |

Users must opt in from **Settings → Email preferences**. Each campaign is logged in `lifecycle_email_log` so nobody gets the same tip twice, and the sender skips users who do not have `lifecycle_emails = true`.

**Setup:**

1. Run migrations `006_lifecycle_emails.sql` and `011_email_preferences_opt_in.sql` in Supabase.
2. Add `CRON_SECRET` in Vercel (generate a long random string).
3. Deploy — `vercel.json` registers the cron job automatically on Vercel.

Templates: [`lib/email/lifecycle-templates.ts`](../lib/email/lifecycle-templates.ts). Logic: [`lib/lifecycle-emails.ts`](../lib/lifecycle-emails.ts).

**Resend setup:**

1. Add and verify your domain in Resend.
2. Configure SPF, DKIM, and DMARC DNS records (Resend provides values).
3. Set `EMAIL_FROM` to an address on that domain (e.g. `noreply@yourdomain.com`).
4. Set `SUPPORT_INBOX` to the mailbox your team monitors.

### Auth emails (Supabase)

Password reset and signup confirmation still flow through **Supabase Auth**. By default these send from Supabase's own generic mailer ("via Supabase") — fix that first, before requiring email confirmation, so new users don't see the unbranded version mid-launch:

1. Supabase Dashboard → **Authentication → Settings → SMTP Settings** → enable custom SMTP:
   - Sender email: `noreply@selrano.com` (must match `EMAIL_FROM`, verified in Resend)
   - Sender name: `Selrano`
   - Host: `smtp.resend.com` · Port: `465` · Username: `resend` · Password: your `RESEND_API_KEY` value
2. Customize templates under **Authentication → Email Templates** (Confirm signup, Reset password) with Selrano branding — reference HTML below, reused from `lib/email/layout.ts`'s style. Swap the copy per template; both use `{{ .ConfirmationURL }}`.
3. Once the sender looks right, go to **Authentication → Providers → Email** and toggle **Confirm email** on.

**Confirm signup** template:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f7f5f0;font-family:'Segoe UI',system-ui,sans-serif;color:#15181f;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f0;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffefa;border:1px solid rgba(31,35,44,0.1);border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 8px;font-size:22px;font-weight:800;letter-spacing:-0.03em;">Selrano</td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;font-size:15px;line-height:1.6;color:#69707d;">
              <p style="margin:0 0 16px;color:#15181f;font-size:16px;font-weight:700;">Confirm your email</p>
              <p style="margin:0 0 24px;">Click below to confirm your email and finish setting up your Selrano workspace.</p>
              <p style="margin:0 0 24px;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#15181f;color:#fffefa;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:700;font-size:14px;">Confirm email</a>
              </p>
              <p style="margin:0;font-size:13px;">If you didn't create a Selrano account, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(31,35,44,0.1);font-size:12px;line-height:1.5;color:#69707d;">
              © Selrano. All rights reserved. · <a href="https://selrano.com/support" style="color:#15181f;">Support</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

**Reset password** template — same style, paste into **Authentication → Email Templates → Reset Password**:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f7f5f0;font-family:'Segoe UI',system-ui,sans-serif;color:#15181f;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f0;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffefa;border:1px solid rgba(31,35,44,0.1);border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 8px;font-size:22px;font-weight:800;letter-spacing:-0.03em;">Selrano</td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;font-size:15px;line-height:1.6;color:#69707d;">
              <p style="margin:0 0 16px;color:#15181f;font-size:16px;font-weight:700;">Reset your password</p>
              <p style="margin:0 0 24px;">We received a request to reset the password for your Selrano account. Click below to choose a new one.</p>
              <p style="margin:0 0 24px;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#15181f;color:#fffefa;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:700;font-size:14px;">Reset password</a>
              </p>
              <p style="margin:0;font-size:13px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(31,35,44,0.1);font-size:12px;line-height:1.5;color:#69707d;">
              © Selrano. All rights reserved. · <a href="https://selrano.com/support" style="color:#15181f;">Support</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

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
- [ ] Confirm production schema and tracked migration history match the intended release
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
8. `010_security_hardening.sql`
9. `011_email_preferences_opt_in.sql`
10. `012_restore_support_request_insert.sql`
11. `013_atomic_ai_quota.sql`
12. `014_file_search_fts.sql`
13. `015_fix_service_role_grants.sql`
14. `016_block_placeholder_email_domains.sql`
15. `20260710214928_reconcile_launch_contracts.sql`

Production historically received some numbered migrations outside tracked migration history. Compare the remote schema and migration list before applying anything; prefer a focused idempotent reconciliation over replaying every file.

### Historical Pro waitlist

The public Pro waitlist is closed now that billing is live. Historical signups remain in **`pro_waitlist`** and can be exported as CSV if needed:

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
