# Stripe billing setup

Selrano uses Free and Pro ($19/mo). Pro unlocks via Stripe Checkout; limits live in `user_limits` and are enforced in API routes.

## 1. Stripe Dashboard

1. Go to Stripe Dashboard > Products > Add product.
2. Name: `Selrano Pro`
3. Price: $19.00 / month, recurring
4. Copy the Price ID (`price_...`)

## 2. Vercel environment variables

```txt
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
```

Redeploy after adding.

## 3. Webhook

Stripe > Developers > Webhooks > Add endpoint

- URL: `https://selrano.com/api/billing/webhook`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.

Local testing: `stripe listen --forward-to localhost:3000/api/billing/webhook`

## 4. Supabase migration

Run `supabase/migrations/005_billing.sql` in SQL Editor.

## 5. Customer portal

Stripe > Settings > Billing > Customer portal. Enable so users can cancel or update their card from Settings.

## Plan limits

| | Free | Pro |
|---|------|-----|
| AI / day | 20 | 500 |
| Client workspaces | 3 | Unlimited |
| File size | 20 MB | 100 MB |
| Brief decks | 5 | Unlimited |

## Revenue math

~105 Pro subscribers at $19/mo is about $2,000/mo before Stripe fees.

## Test flow

1. Sign in > Settings > Upgrade to Pro
2. Stripe test card: `4242 4242 4242 4242`
3. Confirm `user_limits.tier = pro` in Supabase
4. AI limit should show 500/day in Settings
