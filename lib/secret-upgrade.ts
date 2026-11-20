import type { SupabaseClient } from "@supabase/supabase-js";
import { hasDedicatedKey, openSecret, sealSecret, sealedVersion } from "@/lib/secret-box";

type Target = { table: string; match: string[]; columns: string[] };

const TARGETS: Target[] = [
  { table: "plaid_items", match: ["user_id", "item_id"], columns: ["access_token_encrypted"] },
  { table: "google_connections", match: ["user_id"], columns: ["refresh_token_encrypted", "access_token_encrypted"] }
];

/**
 * Re-locks stored logins that still use the original v1 key as v2 (the dedicated
 * TOKEN_ENCRYPTION_KEY). Safe to repeat: it does nothing until the dedicated key
 * exists, skips values already on v2, and only saves a new value after reading it
 * back and checking it matches the original. A value that cannot be read is left
 * untouched and reported, never deleted.
 */
export async function upgradeStoredSecrets(admin: SupabaseClient) {
  const result = { upgraded: 0, skipped: 0, failed: 0 };
  if (!hasDedicatedKey()) return result;

  for (const target of TARGETS) {
    const { data, error } = await admin.from(target.table).select([...target.match, ...target.columns].join(", "));
    if (error || !data) {
      if (error) console.error("[secret-upgrade] could not read", target.table);
      result.failed += error ? 1 : 0;
      continue;
    }
    for (const row of data as unknown as Array<Record<string, string | null>>) {
      const changes: Record<string, string> = {};
      for (const column of target.columns) {
        const value = row[column];
        if (!value) continue;
        if (sealedVersion(value) !== "v1") {
          result.skipped += 1;
          continue;
        }
        try {
          const plain = await openSecret(value);
          const upgraded = await sealSecret(plain, "v2");
          if ((await openSecret(upgraded)) !== plain) throw new Error("check failed");
          changes[column] = upgraded;
        } catch {
          console.error("[secret-upgrade] left unchanged", target.table, column);
          result.failed += 1;
        }
      }
      if (!Object.keys(changes).length) continue;
      let update = admin.from(target.table).update(changes);
      for (const column of target.match) update = update.eq(column, row[column] as string);
      const { error: updateError } = await update;
      if (updateError) {
        console.error("[secret-upgrade] could not save", target.table);
        result.failed += Object.keys(changes).length;
      } else {
        result.upgraded += Object.keys(changes).length;
      }
    }
  }
  return result;
}
