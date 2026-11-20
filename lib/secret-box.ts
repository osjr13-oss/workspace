/**
 * Encrypts small secrets (Google and bank sign-in tokens) before they are stored.
 *
 * AES-GCM. Two key sources, told apart by the version prefix on each value:
 *   v2  derived (HKDF) from TOKEN_ENCRYPTION_KEY, a dedicated Worker secret. Used for
 *       every new value once that secret exists. Replacing the database master key
 *       no longer affects these.
 *   v1  derived from SUPABASE_SERVICE_ROLE_KEY (the original scheme). Still readable,
 *       and re-locked as v2 by `upgradeStoredSecrets` (lib/secret-upgrade.ts).
 * Anyone holding the key already has full database access; the encryption keeps
 * tokens unreadable in backups, exports and the Supabase table editor.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const cachedKeys = new Map<string, Promise<CryptoKey>>();

const MIN_DEDICATED_KEY_LENGTH = 32;

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

/** The dedicated key, when it is set. A short or placeholder value is refused so a typo cannot weaken the lock. */
function dedicatedSecret() {
  const secret = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!secret) return null;
  if (secret.length < MIN_DEDICATED_KEY_LENGTH) throw new Error(`TOKEN_ENCRYPTION_KEY must be at least ${MIN_DEDICATED_KEY_LENGTH} characters`);
  return secret;
}

export function hasDedicatedKey() {
  return Boolean(dedicatedSecret());
}

/** Which scheme sealed this value ("v1" or "v2"), or null if it is not a sealed value. */
export function sealedVersion(value: string | null | undefined) {
  const version = value?.split(".")[0];
  return version === "v1" || version === "v2" ? version : null;
}

function key(version: "v1" | "v2") {
  let secret: string | null | undefined;
  let info: string;
  if (version === "v2") {
    secret = dedicatedSecret();
    if (!secret) throw new Error("TOKEN_ENCRYPTION_KEY is not configured");
    info = "selrano-token-encryption-v2";
  } else {
    secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    info = "selrano-connected-account-tokens";
  }
  const cacheId = `${version}:${secret}`;
  let cached = cachedKeys.get(cacheId);
  if (!cached) {
    cached = crypto.subtle
      .importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"])
      .then((material) =>
        crypto.subtle.deriveKey(
          { name: "HKDF", hash: "SHA-256", salt: encoder.encode("selrano"), info: encoder.encode(info) },
          material,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        )
      );
    cachedKeys.set(cacheId, cached);
  }
  return cached;
}

export async function sealSecret(plain: string, version: "v1" | "v2" = hasDedicatedKey() ? "v2" : "v1") {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(version), encoder.encode(plain)));
  return `${version}.${toBase64(iv)}.${toBase64(sealed)}`;
}

export async function openSecret(value: string) {
  const [version, iv, sealed] = value.split(".");
  if ((version !== "v1" && version !== "v2") || !iv || !sealed) throw new Error("Unrecognized sealed secret");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, await key(version), fromBase64(sealed));
  return decoder.decode(plain);
}
