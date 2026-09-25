export const PLANS = {
  free: {
    id: "free" as const,
    name: "Free",
    aiRequests: 20
  },
  pro: {
    id: "pro" as const,
    name: "Pro",
    priceMonthly: 6.99,
    priceKind: "founding" as const,
    stripePriceAmountCents: 699,
    aiRequests: 1500
  }
} as const;

export function formatPlanPrice(priceMonthly: number) {
  const fixed = priceMonthly.toFixed(2);
  return `$${fixed.endsWith(".00") ? fixed.slice(0, -3) : fixed}`;
}
