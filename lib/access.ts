/**
 * Selrano is a private personal AI. Only accounts whose email is listed in
 * ALLOWED_EMAILS (comma-separated, a Cloudflare Worker secret) can sign in or
 * call the API. An empty or missing list lets nobody in.
 *
 * Pages anyone can open: the landing page, sign in, password reset, the auth
 * callback, and the legal pages. Everything else requires an allowed account.
 */

const OPEN_PATHS = new Set(["/", "/signin", "/reset-password", "/privacy", "/terms", "/security", "/robots.txt"]);
const OPEN_PREFIXES = ["/auth/", "/opengraph-image"];

export function allowedEmails() {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string | null | undefined) {
  if (!email) return false;
  return allowedEmails().includes(email.trim().toLowerCase());
}

/** Pages anyone can open. API routes check the account themselves. */
export function isOpenPath(pathname: string) {
  return OPEN_PATHS.has(pathname) || OPEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
