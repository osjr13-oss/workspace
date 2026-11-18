# Cloudflare Workers hosting

## Build and runtime

Use Node 22.12 or newer. OpenNext packages the existing Next.js app for Workers. Public prerendered pages and icons use Workers static assets. The app does not require a new database, bucket, or image service. Supabase still owns authentication, the database and private file storage.

Build in a clean checkout. OpenNext copies local .env files into its generated server module, including values for other environments. The build check rejects these files. Supply NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and NEXT_PUBLIC_APP_URL as build environment variables. Set the same three in the Worker's runtime configuration because server code also looks them up by name. For the production build use the existing production Supabase project and the site's canonical origin. Review any other NEXT_PUBLIC_ overrides used by production before building.

- Install dependencies with `npm ci`.
- Build with `npm run build:worker`. Start a local runtime with `npm run preview:worker`. Locally, Wrangler reads runtime secrets from the ignored .dev.vars file.
- Use `npx --no-install wrangler deploy --dry-run` to inspect bundle size. This step does not publish.
- Publish with `npm run deploy:worker` from the clean checkout with public build variables set. This builds and runs the OpenNext deploy command, including populating the static cache.

## Production releases

Pushes to main trigger Workers Builds for osjr13-oss/workspace. Review the matching commit under **Workers & Pages > selrano > Deployments** and the GitHub Actions result. Build-time configuration contains the three public settings only. Server credentials stay in encrypted Worker secrets.

## Recreate the hosting setup

1. Use the owner's paid Workers account. Deploy the Worker named selrano and verify the workers.dev address before attaching either live domain.
2. In **Workers & Pages > selrano > Settings > Variables and Secrets**, enter production server credentials as secrets. Match the production settings for Supabase service access, OpenAI, Groq, Exa, Stripe, Resend and scheduled jobs. Preserve configured model, sender, price and embedding settings. Use .env.example for names. Test provider base URLs belong only in local tests.
3. In **Settings > Builds**, connect the existing GitHub repository, choose main, and disable non-production branch builds. Use `npm run build:worker` for the build command and `npx --no-install opennextjs-cloudflare deploy` for deployment. Set the public build variables separately under build settings.
4. On the deployed Worker, verify sign-in, streamed and cited answers, a private file upload with text extraction, and authenticated billing status. Verify Stripe delivery using a test event without creating a customer charge. Confirm each required production setting before cutover.

## Domain and schedule cutover

1. Export or record the complete DNS configuration from the current registrar, including mail, verification, subdomains and DNSSEC state. Add selrano.com to the correct Cloudflare account and compare the imported zone against the registrar. Preserve the old web records and all mail and service records while changing nameservers. A Cloudflare quick scan alone does not establish a complete zone.
2. Set the registrar's nameservers to the exact pair assigned to this zone. Follow Cloudflare's DNSSEC transition instructions if the old zone has a parent DS record. Wait for the zone to become active and verify the existing site and mail records.
3. Production uses Worker routes for both hostnames in wrangler.jsonc. Both web records are proxied A records at 192.0.2.0, Cloudflare's reserved placeholder for a site served entirely by its Worker. The Worker redirects the apex to www with HTTP 308 and preserves the path and query.
4. The Worker schedules in wrangler.jsonc call grounded-history at 13:00 UTC and lifecycle-emails at 14:00 UTC through the Worker self-binding. Verify their execution records after the scheduled times.
5. Verify the public site, sign-in, a cited answer, an upload, billing, and a release from main. For a code rollback, select a known-good version under **Workers & Pages > selrano > Deployments**. Keep the Worker routes and DNS proxy active.

[Cloudflare custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) · [DNS migration](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/) · [OpenNext setup](https://opennext.js.org/cloudflare/get-started)
