/**
 * Single source of truth for product branding.
 * Override via environment variables in production (Vercel).
 */
export const brand = {
  name: "Selrano",
  tagline: "A calm, personal coach for food, weight, and everyday health.",
  legalName: process.env.NEXT_PUBLIC_LEGAL_NAME || "Selrano",

  emails: {
    noreply: process.env.EMAIL_FROM || "Selrano <noreply@selrano.com>"
  },

  urls: {
    app: process.env.NEXT_PUBLIC_APP_URL || "https://selrano.com",
    terms: "/terms",
    privacy: "/privacy",
    security: "/security",
    status: process.env.NEXT_PUBLIC_STATUS_URL || "",
    docs: process.env.NEXT_PUBLIC_DOCS_URL || ""
  },

  colors: {
    background: "#f7f5f0",
    text: "#15181f",
    muted: "#69707d",
    accent: "#15181f"
  }
} as const;

export function absoluteUrl(path: string) {
  const base = brand.urls.app.replace(/\/$/, "");
  return path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
