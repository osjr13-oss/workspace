# Supabase Setup

Run `supabase/migrations/001_initial_schema.sql` in your Supabase project before using the app.

Required project settings:

- Email/password auth enabled.
- Site URL set to the deployed Vercel URL for password reset links.
- `workspace-files` bucket is created by the migration and remains private.

Required Vercel environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `GROQ_MODEL`
