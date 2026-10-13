/**
 * Selrano is private while the owner builds it. Only accounts whose email is
 * listed in ALLOWED_EMAILS (comma-separated, set in Vercel) can sign in or call
 * the API. An empty or missing list lets nobody in.
 *
 * Pages that stay reachable without an allowed account: sign in, password reset,
 * the auth callback, and the legal pages. Everything else, including the landing
 * page, pricing, guides, and shared decks, sends visitors to sign in.
 * docs/HANDOFF.md ("Private access") describes how to reopen to the public.
 */

const OPEN_PATHS = new Set(["/signin", "/reset-password", "/privacy", "/terms", "/security", "/robots.txt"]);
const OPEN_PREFIXES = ["/auth/"];

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

/** Pages anyone can open while Selrano is private. API routes check the account themselves. */
export function isOpenPath(pathname: string) {
  return OPEN_PATHS.has(pathname) || OPEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
