/**
 * Script rules for every page. Each response carries a fresh one-time nonce, and
 * Next puts it on its own scripts, so the browser refuses any other script (for
 * example one injected into a page). 'strict-dynamic' lets a trusted script load
 * the ones it needs, such as Plaid Link on the Money page.
 *
 * Only scripts are restricted: styles, images, fonts and frames are untouched, so
 * the bank connection screen and Supabase keep working. Frames cannot embed
 * Selrano (frame-ancestors).
 */
export function contentSecurityPolicy(nonce: string, development = process.env.NODE_ENV !== "production") {
  return [
    // The dev server needs eval for hot reloading; production never does.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // The offline helper (sw.js) is a worker, which 'strict-dynamic' would otherwise block.
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'"
  ].join("; ");
}

export function newNonce() {
  return btoa(crypto.randomUUID());
}
