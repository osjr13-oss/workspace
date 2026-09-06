import { lookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import { Agent } from "undici";
import ipaddr from "ipaddr.js";

// Blocks RFC-1918 private ranges, loopback, link-local, cloud metadata, and IPv6 equivalents.
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  // IPv6 loopback and link-local
  /^::1$/,
  /^\[::1\]$/,
  /^0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,1}1$/i,
  /^fc00:/i,
  /^fe80:/i,
  // IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1)
  /^::ffff:(127\.|10\.|192\.168\.|169\.254\.)/i,
  /^::ffff:0:(127\.|10\.|192\.168\.|169\.254\.)/i,
  /^0\./,
  /^metadata\.google\.internal$/i,
  /^169\.254\.169\.254$/,
  /^kubernetes\.default/i,
];

const DNS_LOOKUP_TIMEOUT_MS = 3000;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timeout: NodeJS.Timeout;
  return new Promise((resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}

function isBlockedHost(hostname: string): boolean {
  return BLOCKED_HOST_PATTERNS.some((p) => p.test(hostname));
}

export function isPublicIpAddress(address: string): boolean {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}

export function normalizeScanUrl(input: string): URL {
  const trimmed = input.trim();
  if (trimmed.length > 2048) throw new Error("Website URL is too long.");

  if (!trimmed) {
    throw new Error("Enter a public website URL.");
  }

  if (
    /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) &&
    !/^https?:\/\//i.test(trimmed)
  ) {
    throw new Error("Selrano only scans public HTTP and HTTPS websites.");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const parsed = new URL(withProtocol);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Selrano only scans public HTTP and HTTPS websites.");
  }

  if (isBlockedHost(parsed.hostname)) {
    throw new Error("Selrano only scans public websites.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("Website URLs cannot include credentials.");
  }

  if (
    (parsed.protocol === "http:" && parsed.port && parsed.port !== "80") ||
    (parsed.protocol === "https:" && parsed.port && parsed.port !== "443")
  ) {
    throw new Error("Selrano only scans standard public web ports.");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname) && !isPublicIpAddress(hostname)) {
    throw new Error("Selrano only scans public websites.");
  }
  if (/\.(localhost|local|internal)$/i.test(hostname))
    throw new Error("Selrano only scans public websites.");
  // Query strings can contain login tokens. Scan the public path only.
  parsed.search = "";
  parsed.hash = "";

  return parsed;
}

export async function resolvePublicAddresses(
  hostname: string,
): Promise<string[]> {
  hostname = hostname.replace(/^\[|\]$/g, "");
  if (isBlockedHost(hostname)) {
    throw new Error("Selrano only scans public websites.");
  }

  if (isIP(hostname)) {
    if (!isPublicIpAddress(hostname)) {
      throw new Error("Selrano only scans public websites.");
    }
    return [hostname];
  }

  const addresses = await withTimeout(
    lookup(hostname, { all: true, verbatim: true }),
    DNS_LOOKUP_TIMEOUT_MS,
    "The website took too long to resolve.",
  );
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => !isPublicIpAddress(address))
  ) {
    throw new Error("Selrano only scans public websites.");
  }

  return addresses.map(({ address }) => address);
}

const guardedLookup: LookupFunction = (hostname, options, callback) => {
  resolvePublicAddresses(hostname)
    .then((addresses) => {
      const resolved = addresses.map((address) => ({
        address,
        family: isIP(address),
      }));
      if (options.all) {
        callback(null, resolved);
        return;
      }
      callback(null, resolved[0].address, resolved[0].family);
    })
    .catch((error: unknown) => {
      callback(
        error instanceof Error
          ? error
          : new Error("Could not resolve a public website."),
        "",
        0,
      );
    });
};

const publicFetchDispatcher = new Agent({
  connect: {
    lookup: guardedLookup,
  },
});

export async function fetchPublicUrl(
  input: string | URL,
  init: RequestInit = {},
  maxRedirects = 3,
): Promise<{ response: Response; finalUrl: URL }> {
  let current = normalizeScanUrl(input.toString());

  for (
    let redirectCount = 0;
    redirectCount <= maxRedirects;
    redirectCount += 1
  ) {
    await resolvePublicAddresses(current.hostname);
    const response = await fetch(current, {
      ...init,
      redirect: "manual",
      dispatcher: publicFetchDispatcher,
    } as RequestInit & { dispatcher: Agent });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { response, finalUrl: current };
    }

    const location = response.headers.get("location");
    if (!location || redirectCount === maxRedirects) {
      await response.body?.cancel();
      throw new Error("The website redirected too many times.");
    }

    await response.body?.cancel();
    current = normalizeScanUrl(new URL(location, current).toString());
  }

  throw new Error("The website redirected too many times.");
}

export async function readTextResponse(
  response: Response,
  maxBytes = 1_000_000,
): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel();
    throw new Error("The website response is too large to scan safely.");
  }

  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new Error("The website response is too large to scan safely.");
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("The website response is too large to scan safely.");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export function getRegistrableHost(url: string): string {
  return new URL(url).hostname.replace(/^www\./i, "");
}

export function isSameHost(target: string, source: string): boolean {
  try {
    return getRegistrableHost(target) === getRegistrableHost(source);
  } catch {
    return false;
  }
}
