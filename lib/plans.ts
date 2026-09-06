export type TierId = "free" | "pro";

export type AiQuotaPeriod = "day" | "month";

/**
 * Canonical plan limits and pricing.
 * Pro `priceKind: "founding"` is an internal label for the introductory $6.99/mo price.
 * Public acquisition pages should not advertise exact AI allowances; authenticated billing may.
 */
export const PLANS = {
  free: {
    id: "free" as const,
    name: "Free",
    tagline: "Everything you need to try Selrano",
    priceMonthly: 0,
    priceKind: "standard" as const,
    aiRequests: 20,
    aiPeriod: "day" as const satisfies AiQuotaPeriod,
    scansPerDay: 5,
    maxProjects: 3,
    maxFileMb: 20,
    maxDecks: 8,
    semanticSearch: true
  },
  pro: {
    id: "pro" as const,
    name: "Pro",
    tagline: "For builders shipping and improving every day",
    /** Founding / introductory monthly price in USD. */
    priceMonthly: 6.99,
    priceKind: "founding" as const,
    /** Stripe unit amount in cents for the founding Pro price. */
    stripePriceAmountCents: 699,
    aiRequests: 1500,
    aiPeriod: "month" as const satisfies AiQuotaPeriod,
    scansPerDay: 50,
    maxProjects: null as number | null,
    maxFileMb: 100,
    maxDecks: null as number | null,
    semanticSearch: true
  }
} as const;

export function getPlan(tier: string) {
  return tier === "pro" ? PLANS.pro : PLANS.free;
}

/** Display helper so $6.99 stays exact and whole-dollar plans stay clean. */
export function formatPlanPrice(priceMonthly: number) {
  if (priceMonthly === 0) return "Free";
  const fixed = priceMonthly.toFixed(2);
  return `$${fixed.endsWith(".00") ? fixed.slice(0, -3) : fixed}`;
}
