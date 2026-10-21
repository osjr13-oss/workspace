import Link from "next/link";
import { Check } from "lucide-react";
import { ProCheckoutButton } from "@/components/pro-checkout-button";
import { SpotlightCard } from "@/components/spotlight-card";
import { formatPlanPrice, PLANS } from "@/lib/plans";

const rows = [
  { label: "Adaptive AI chat", free: "Included", pro: "Included" },
  { label: "Projects", free: String(PLANS.free.maxProjects), pro: "Unlimited" },
  { label: "Max file upload", free: `${PLANS.free.maxFileMb} MB`, pro: `${PLANS.pro.maxFileMb} MB` },
  { label: "Flashcard decks", free: String(PLANS.free.maxDecks), pro: "Unlimited" },
  { label: "Project file context in chat", free: "Yes", pro: "Yes" },
  { label: "Notes, study mode, flashcards", free: "Yes", pro: "Yes" }
] as const;

export function PricingTable({ showCta = true }: { showCta?: boolean }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {(["free", "pro"] as const).map((key) => {
        const plan = PLANS[key];
        const isPro = key === "pro";
        return (
          <SpotlightCard key={key} className={`panel p-7 ${isPro ? "border-[var(--border-strong)]" : ""}`}>
            <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">{plan.name}</p>
            <p className="mt-3 text-4xl font-extrabold tracking-[-0.04em]">
              {plan.priceMonthly === 0 ? "Free" : formatPlanPrice(plan.priceMonthly)}
              {plan.priceMonthly > 0 ? <span className="text-base font-bold text-[var(--muted)]">/mo</span> : null}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">{plan.tagline}</p>
            <ul className="mt-6 space-y-3">
              {rows.map((row) => (
                <li key={row.label} className="flex items-start gap-3 text-sm">
                  <Check size={16} className="mt-0.5 shrink-0 text-[var(--low)]" />
                  <span>
                    <strong>{isPro ? row.pro : row.free}</strong>: {row.label}
                  </span>
                </li>
              ))}
            </ul>
            {showCta ? (
              <div className="mt-8">
                {isPro ? (
                  <ProCheckoutButton />
                ) : (
                  <Link href="/signup" className="btn-secondary w-full justify-center">
                    Get started free
                  </Link>
                )}
              </div>
            ) : null}
          </SpotlightCard>
        );
      })}
    </div>
  );
}
