// OpenNext embeds application .env files into its Worker module. Keep server
// credentials in Worker secrets and supply public build settings via the environment.
import { existsSync } from "node:fs";

const files = [".env", ".env.local", ...["production", "development", "test"].flatMap(
  (mode) => [`.env.${mode}`, `.env.${mode}.local`]
)];
if (files.some((file) => existsSync(file))) {
  throw new Error("Build the Worker in a clean checkout without .env files. See docs/CLOUDFLARE.md.");
}
for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_APP_URL"]) {
  if (!process.env[name]?.trim()) throw new Error(`Missing public build setting: ${name}`);
}
