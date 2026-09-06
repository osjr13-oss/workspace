/**
 * Single source of truth for product branding and public contact channels.
 * Override via environment variables in production (Vercel).
 */
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@selrano.com";

export const brand = {
  name: "Selrano",
  tagline: "Website security clarity for people building with AI.",
  legalName: process.env.NEXT_PUBLIC_LEGAL_NAME || "Selrano",

  emails: {
    /** Public contact. Legal pages use this address too. */
    support: supportEmail,
    hello: supportEmail,
    security: supportEmail,
    privacy: supportEmail,
    noreply: process.env.EMAIL_FROM || "Selrano <noreply@selrano.com>"
  },

  urls: {
    app: process.env.NEXT_PUBLIC_APP_URL || "https://selrano.com",
    terms: "/terms",
    privacy: "/privacy",
    security: "/security",
    support: "/support",
    changelog: "/changelog",
    status: process.env.NEXT_PUBLIC_STATUS_URL || "",
    docs: process.env.NEXT_PUBLIC_DOCS_URL || ""
  },

  support: {
    responseSla: "1 business day",
    hours: "Monday-Friday, 9:00-17:00 US Eastern"
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
