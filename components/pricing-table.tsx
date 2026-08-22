import Link from "next/link";
import { Check } from "lucide-react";
import { ProCheckoutButton } from "@/components/pro-checkout-button";
import { formatPlanPrice, PLANS } from "@/lib/plans";

const rows = [
  { label: "Adaptive AI chat engine", free: "Included", pro: "Included" },
  { label: "Durable memory across sessions", free: "Yes", pro: "Yes" },
  { label: "Live web grounding with source citations", free: "Yes", pro: "Yes" },
  { label: "Active project boundaries", free: String(PLANS.free.maxProjects), pro: "Unlimited" },
  { label: "Maximum file upload size", free: `${PLANS.free.maxFileMb} MB`, pro: `${PLANS.pro.maxFileMb} MB` },
  { label: "Markdown notes and live text extraction", free: "Yes", pro: "Yes" }
] as const;

export function PricingTable({ showCta = true }: { showCta?: boolean }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {(["free", "pro"] as const).map((key) => {
        const plan = PLANS[key];
        const isPro = key === "pro";
        return (
          <div
            key={key}
            className={`panel flex flex-col justify-between p-8 bg-white shadow-sm transition ${
              isPro ? "border-slate-900 ring-1 ring-slate-900" : ""
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className={isPro ? "badge badge-brand" : "badge badge-subtle"}>
                  {plan.name}
                </span>
                {isPro && (
                  <span className="badge badge-success text-[10px]">Founding Member Rate</span>
                )}
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-[var(--text)]">
                  {plan.priceMonthly === 0 ? "Free" : formatPlanPrice(plan.priceMonthly)}
                </span>
                {plan.priceMonthly > 0 && (
                  <span className="text-sm font-semibold text-[var(--muted)]">/month</span>
                )}
              </div>

              <p className="mt-2 text-xs leading-relaxed text-[var(--muted-strong)]">
                {plan.tagline}
              </p>

              <div className="mt-6 border-t border-[var(--border)] pt-6">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-4">
                  Capabilities Included:
                </p>
                <ul className="space-y-3">
                  {rows.map((row) => (
                    <li key={row.label} className="flex items-start gap-2.5 text-xs text-[var(--text)]">
                      <Check size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                      <span>
                        <strong className="font-semibold">{isPro ? row.pro : row.free}</strong>:{" "}
                        <span className="text-[var(--muted-strong)]">{row.label}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {showCta && (
              <div className="mt-8 pt-4 border-t border-[var(--border)]">
                {isPro ? (
                  <ProCheckoutButton />
                ) : (
                  <Link href="/signup" className="btn-secondary w-full justify-center">
                    Get Started Free
                  </Link>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
