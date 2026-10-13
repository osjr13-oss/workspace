/**
 * Run: node scripts/check-setup.mjs
 * Loads .env.local if present (simple KEY=value parser).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const env = { ...process.env, ...loadEnvFile(resolve(root, ".env.local")) };

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GROQ_API_KEY",
  // Selrano is private: only these comma-separated emails can sign in (lib/access.ts).
  "ALLOWED_EMAILS"
];

const branding = ["NEXT_PUBLIC_APP_URL"];

const email = ["RESEND_API_KEY", "EMAIL_FROM"];

const optionalRag = ["EMBEDDING_API_KEY", "TAVILY_API_KEY"];

function status(key) {
  const v = env[key];
  return v && String(v).trim() ? "ok" : "missing";
}

console.log("\n=== Selrano setup check ===\n");

console.log("Required (app + AI):");
for (const key of required) {
  console.log(`  ${status(key) === "ok" ? "✓" : "✗"} ${key}`);
}

console.log("\nBranding (site URL used in email links):");
for (const key of branding) {
  console.log(`  ${status(key) === "ok" ? "✓" : "○"} ${key}`);
}

console.log("\nTransactional email (Resend):");
for (const key of email) {
  console.log(`  ${status(key) === "ok" ? "✓" : "○"} ${key}`);
}

console.log("\nSemantic search (optional):");
for (const key of optionalRag) {
  console.log(`  ${status(key) === "ok" ? "✓" : "○"} ${key}`);
}

const missingRequired = required.filter((k) => status(k) === "missing");
if (missingRequired.length) {
  console.log("\n→ Fix required vars in Vercel (Production) or copy .env.example → .env.local\n");
} else {
  console.log("\n→ Core env looks set. Run DB migration 002_through_004_combined.sql in Supabase if not done.\n");
}

console.log("Full guide: docs/SETUP.md\n");
