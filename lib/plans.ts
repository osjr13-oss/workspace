export type TierId = "free" | "pro";

export const PLANS = {
  free: {
    id: "free" as const,
    name: "Free",
    tagline: "Everything you need to try Selrano with a few clients",
    priceMonthly: 0,
    dailyAiRequests: 20,
    maxProjects: 3,
    maxFileMb: 20,
    maxDecks: 5,
    semanticSearch: true
  },
  pro: {
    id: "pro" as const,
    name: "Pro",
    tagline: "For independent consultants running client work every day",
    priceMonthly: 19,
    dailyAiRequests: 500,
    maxProjects: null as number | null,
    maxFileMb: 100,
    maxDecks: null as number | null,
    semanticSearch: true
  }
} as const;

export function getPlan(tier: string) {
  return tier === "pro" ? PLANS.pro : PLANS.free;
}
