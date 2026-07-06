# Feature flags — launching new features

New features are built and deployed to selrano.com **switched off**, so users
see no change until you're ready. On launch day you flip one switch and the
feature appears for everyone. This lets you deploy safely and reveal on your own
schedule (e.g. alongside an announcement on X).

## How to turn a feature ON (launch day)

1. Go to **Vercel → your project → Settings → Environment Variables**.
2. Find the feature's variable (e.g. `NEXT_PUBLIC_FEATURE_STREAMING_CHAT`).
   - If it isn't there yet, click **Add** and create it.
3. Set its value to `true`, scoped to **Production**.
4. Click **Save**.
5. Go to **Deployments → ⋯ on the latest deploy → Redeploy**.
   (An env-var change only takes effect after a redeploy.)
6. Wait ~1 minute, then open selrano.com — the feature is now live.

## How to turn a feature OFF again

Same steps, but set the value to `false` (or delete the variable), then redeploy.
Handy if you need to pull a feature back quickly.

## Test it privately before launch

The safest way to preview before going public: use **Vercel Preview
Deployments**. Set the flag to `true` only on a preview branch/environment,
open the preview URL, and check it there. Production stays off until you flip it.

## Current flags

| Variable | Feature | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_FEATURE_STREAMING_CHAT` | Chat replies appear word-by-word as they're written, instead of waiting for the full answer. | `false` (hidden) |

_The list grows as new features are built. The source of truth is
[`lib/features.ts`](../lib/features.ts)._
