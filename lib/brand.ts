/**
 * Single source of truth for product branding.
 * Override via environment variables in production (Vercel).
 */
export const brand = {
  name: "Selrano",
  tagline: "Your notes, files, and the web, in one calm place to think.",
  legalName: process.env.NEXT_PUBLIC_LEGAL_NAME || "Selrano",

  emails: {
    noreply: process.env.EMAIL_FROM || "Selrano <noreply@selrano.com>"
  },

  urls: {
    app: process.env.NEXT_PUBLIC_APP_URL || "https://selrano.com",
    terms: "/terms",
    privacy: "/privacy",
    security: "/security",
    changelog: "/changelog",
    status: process.env.NEXT_PUBLIC_STATUS_URL || "",
    docs: process.env.NEXT_PUBLIC_DOCS_URL || ""
  },

  colors: {
    background: "#f6f3ec",
    text: "#16191f",
    muted: "#676b72",
    accent: "#1b2d50"
  }
} as const;

export function absoluteUrl(path: string) {
  const base = brand.urls.app.replace(/\/$/, "");
  return path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
