/**
 * Encrypts small secrets (Google sign-in tokens) before they are stored.
 *
 * AES-GCM with a key derived (HKDF) from SUPABASE_SERVICE_ROLE_KEY, so no extra
 * secret has to be configured. Anyone holding that key already has full
 * database access; the encryption keeps tokens unreadable in backups, exports
 * and the Supabase table editor.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();
let cachedKey: Promise<CryptoKey> | null = null;

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function key() {
  if (!cachedKey) {
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    cachedKey = crypto.subtle
      .importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"])
      .then((material) =>
        crypto.subtle.deriveKey(
          { name: "HKDF", hash: "SHA-256", salt: encoder.encode("selrano"), info: encoder.encode("selrano-connected-account-tokens") },
          material,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        )
      );
  }
  return cachedKey;
}

export async function sealSecret(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), encoder.encode(plain)));
  return `v1.${toBase64(iv)}.${toBase64(sealed)}`;
}

export async function openSecret(value: string) {
  const [version, iv, sealed] = value.split(".");
  if (version !== "v1" || !iv || !sealed) throw new Error("Unrecognized sealed secret");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, await key(), fromBase64(sealed));
  return decoder.decode(plain);
}
