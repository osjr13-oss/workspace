import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasDedicatedKey, openSecret, sealSecret, sealedVersion } from "../lib/secret-box";
import { upgradeStoredSecrets } from "../lib/secret-upgrade";

// The lock on stored Google and bank logins. These run in plain Node, no browser.

const DATABASE_KEY = "test-service-key-original";
const OWN_KEY = "a-long-random-dedicated-key-for-tokens-0123456789";

function setKeys(own: string | undefined, database = DATABASE_KEY) {
  if (own === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
  else process.env.TOKEN_ENCRYPTION_KEY = own;
  process.env.SUPABASE_SERVICE_ROLE_KEY = database;
}

test.afterEach(() => setKeys(undefined));

/** A tiny stand-in for the database client: select everything, update by matching columns. */
function fakeDatabase(tables: Record<string, Array<Record<string, string | null>>>) {
  const client = {
    from(table: string) {
      return {
        select: async () => ({ data: tables[table].map((row) => ({ ...row })), error: null }),
        update(changes: Record<string, string>) {
          const filters: Array<[string, string]> = [];
          const builder: any = {
            eq(column: string, value: string) {
              filters.push([column, value]);
              return builder;
            },
            then(resolve: (value: { error: null }) => void) {
              for (const row of tables[table]) if (filters.every(([column, value]) => row[column] === value)) Object.assign(row, changes);
              resolve({ error: null });
            }
          };
          return builder;
        }
      };
    }
  };
  return client as unknown as SupabaseClient;
}

test("without the dedicated key, logins are locked the original way", async () => {
  setKeys(undefined);
  expect(hasDedicatedKey()).toBe(false);
  const sealed = await sealSecret("access-token");
  expect(sealedVersion(sealed)).toBe("v1");
  expect(await openSecret(sealed)).toBe("access-token");
});

test("with the dedicated key, new logins use it and survive replacing the database key", async () => {
  setKeys(OWN_KEY);
  const sealed = await sealSecret("access-token");
  expect(sealedVersion(sealed)).toBe("v2");
  expect(sealed).not.toContain("access-token");
  setKeys(OWN_KEY, "a-completely-different-database-key");
  expect(await openSecret(sealed)).toBe("access-token");
});

test("old logins stay readable after the dedicated key is added", async () => {
  setKeys(undefined);
  const old = await sealSecret("old-token");
  setKeys(OWN_KEY);
  expect(await openSecret(old)).toBe("old-token");
});

test("a short or mistyped dedicated key is refused instead of weakening the lock", async () => {
  setKeys("too-short");
  await expect(sealSecret("access-token")).rejects.toThrow(/at least 32/);
});

test("the upgrade re-locks old logins, keeps their meaning, and is safe to repeat", async () => {
  setKeys(undefined);
  const bank = await sealSecret("bank-token");
  const refresh = await sealSecret("google-refresh");
  const access = await sealSecret("google-access");
  const tables = {
    plaid_items: [{ user_id: "u1", item_id: "i1", access_token_encrypted: bank }],
    google_connections: [{ user_id: "u1", refresh_token_encrypted: refresh, access_token_encrypted: access }]
  };
  const db = fakeDatabase(tables);

  // Before the dedicated key exists nothing changes.
  expect(await upgradeStoredSecrets(db)).toEqual({ upgraded: 0, skipped: 0, failed: 0 });
  expect(tables.plaid_items[0].access_token_encrypted).toBe(bank);

  setKeys(OWN_KEY);
  expect(await upgradeStoredSecrets(db)).toEqual({ upgraded: 3, skipped: 0, failed: 0 });
  expect(sealedVersion(tables.plaid_items[0].access_token_encrypted)).toBe("v2");
  expect(sealedVersion(tables.google_connections[0].refresh_token_encrypted)).toBe("v2");

  // Replacing the database key afterwards no longer matters.
  setKeys(OWN_KEY, "replaced-database-key");
  expect(await openSecret(tables.plaid_items[0].access_token_encrypted as string)).toBe("bank-token");
  expect(await openSecret(tables.google_connections[0].refresh_token_encrypted as string)).toBe("google-refresh");
  expect(await openSecret(tables.google_connections[0].access_token_encrypted as string)).toBe("google-access");

  // A second run finds nothing left to do.
  expect(await upgradeStoredSecrets(db)).toEqual({ upgraded: 0, skipped: 3, failed: 0 });
});

test("a login that cannot be read is left exactly as it was", async () => {
  setKeys(undefined);
  const unreadable = await sealSecret("lost-token");
  setKeys(OWN_KEY, "the-database-key-was-already-replaced");
  const tables = { plaid_items: [{ user_id: "u1", item_id: "i1", access_token_encrypted: unreadable }], google_connections: [] };
  expect(await upgradeStoredSecrets(fakeDatabase(tables))).toEqual({ upgraded: 0, skipped: 0, failed: 1 });
  expect(tables.plaid_items[0].access_token_encrypted).toBe(unreadable);
});
