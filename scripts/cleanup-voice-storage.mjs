/**
 * Delete orphaned Voice Study recordings from workspace-files storage.
 * Run: npm run cleanup:voice-storage
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUCKET = "workspace-files";

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
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function collectVoicePaths() {
  const paths = [];
  const { data: users, error: rootError } = await supabase.storage.from(BUCKET).list("", { limit: 1000 });
  if (rootError) throw rootError;

  for (const entry of users ?? []) {
    if (entry.id) continue;
    const voicePrefix = `${entry.name}/voice`;
    const { data: files, error } = await supabase.storage.from(BUCKET).list(voicePrefix, { limit: 1000 });
    if (error) {
      if (error.message?.includes("not found")) continue;
      throw error;
    }
    for (const file of files ?? []) {
      if (file.id) paths.push(`${voicePrefix}/${file.name}`);
    }
  }

  return paths;
}

const paths = await collectVoicePaths();

if (paths.length === 0) {
  console.log("No voice recordings found in storage.");
  process.exit(0);
}

console.log(`Removing ${paths.length} file(s)...`);

for (let i = 0; i < paths.length; i += 100) {
  const batch = paths.slice(i, i + 100);
  const { error } = await supabase.storage.from(BUCKET).remove(batch);
  if (error) throw error;
}

console.log("Done.");
