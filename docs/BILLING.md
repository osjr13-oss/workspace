# Stripe billing setup

Selrano uses Free and Pro. Pro is currently a **founding / introductory** price of **$6.99/mo** (internal label: `priceKind: "founding"` in `lib/plans.ts`). Pro unlocks via Stripe Checkout; limits live in `user_limits` and are enforced in API routes plus Postgres triggers/RPCs.

## 1. Stripe Dashboard (founding Pro price)

1. Go to Stripe Dashboard > Products.
2. Open or create product: `Selrano Pro`.
3. Add a new recurring price: **$6.99 / month**.
4. Optional: nickname the price `Pro founding` so it is easy to spot later.
5. Copy the new Price ID (`price_...`).
6. Set Vercel `STRIPE_PRO_PRICE_ID` to that ID (production and preview).
7. Archive or leave unused the old $19/mo price so new checkouts cannot pick it up. Existing subscribers on the old price stay on it until you migrate them in Stripe.

Checkout calls `assertFoundingProPrice()` and refuses to start if `STRIPE_PRO_PRICE_ID` is not a monthly price of **699 cents**.

## 2. Vercel environment variables

```txt
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...   # must be the $6.99/mo founding price
```

Redeploy after adding or changing.

## 3. Webhook

Stripe > Developers > Webhooks > Add endpoint

- URL: `https://selrano.com/api/billing/webhook`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`

Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.

Local testing: `stripe listen --forward-to localhost:3000/api/billing/webhook`

## 4. Supabase migration

Apply tracked migrations through a compared workflow. Founding limits are in `supabase/migrations/20260813120000_founding_pricing_limits.sql` (Free deck cap 8; Pro AI 1500/UTC month). Do not paste only early SQL into production.

## 5. Customer portal

Stripe > Settings > Billing > Customer portal. Enable so users can cancel or update their card from Settings.

## Plan limits

| | Free | Pro (founding $6.99/mo) |
|---|------|-----|
| AI requests | 20 / day | 1500 / month |
| Projects | 3 | Unlimited |
| File size | 20 MB | 100 MB |
| Flashcard decks | 8 | Unlimited |

Canonical source: `lib/plans.ts`. Public pricing pages should not advertise exact AI allowances; authenticated Settings may show usage against the plan limit.

## Revenue math

~287 Pro subscribers at $6.99/mo is about $2,000/mo before Stripe fees.

## Test flow

1. Sign in > Settings > Upgrade to Pro
2. Stripe test card: `4242 4242 4242 4242`
3. Confirm Checkout shows **$6.99**
4. Confirm `user_limits.tier = pro` in Supabase
5. Confirm Pro AI allowance is 1500 per UTC month after `20260813120000_founding_pricing_limits.sql` is applied
