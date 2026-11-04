import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { ProCheckoutButton } from "@/components/pro-checkout-button";
import { formatPlanPrice, PLANS } from "@/lib/plans";

const rows = [
  { label: "Chat grounded in your files and notes", free: true, pro: true },
  { label: "Live web search with sources", free: true, pro: true },
  { label: "Projects", free: String(PLANS.free.maxProjects), pro: "Unlimited" },
  { label: "Largest upload", free: `${PLANS.free.maxFileMb} MB`, pro: `${PLANS.pro.maxFileMb} MB` },
  { label: "Flashcard decks", free: String(PLANS.free.maxDecks), pro: "Unlimited" },
  { label: "Notes, transformations, and Study", free: true, pro: true },
  { label: "Room for daily, heavy use", free: false, pro: true }
] as const;

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <Check size={17} className="text-[var(--accent)]" strokeWidth={2.25} aria-label="Included" />;
  if (value === false) return <Minus size={17} className="text-[var(--border-strong)]" aria-label="Not included" />;
  return <span className="font-medium text-[var(--text)]">{value}</span>;
}

export function PricingTable({ showCta = true }: { showCta?: boolean }) {
  return (
    <div className="space-y-16">
      <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
        {(["free", "pro"] as const).map((key) => {
          const plan = PLANS[key];
          const isPro = key === "pro";
          const highlights = isPro
            ? ["Everything in Free", "Unlimited projects and decks", `Uploads up to ${plan.maxFileMb} MB`, "Room for daily, heavy use"]
            : ["Chat grounded in your sources", `${plan.maxProjects} projects, ${plan.maxDecks} decks`, `Uploads up to ${plan.maxFileMb} MB`, "Notes, flashcards, and Study"];
          return (
            <div
              key={key}
              className={`flex flex-col rounded-[22px] border bg-[var(--surface)] p-7 sm:p-8 ${
                isPro ? "border-[var(--accent)] shadow-[var(--shadow-lift)]" : "border-[var(--border)] shadow-[var(--shadow-tight)]"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-semibold">{plan.name}</h2>
                {isPro ? <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--accent)]">Founding price</span> : null}
              </div>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-[52px] font-medium leading-none tracking-[-0.02em]">
                  {plan.priceMonthly === 0 ? "$0" : formatPlanPrice(plan.priceMonthly)}
                </span>
                <span className="text-[15px] text-[var(--muted)]">/ month</span>
              </p>
              <p className="mt-3 text-[15px] text-[var(--muted-strong)]">{plan.tagline}</p>
              <ul className="mt-6 flex-1 space-y-2.5 border-t border-[var(--border)] pt-6">
                {highlights.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[15px]">
                    <Check size={16} className="mt-[3px] shrink-0 text-[var(--accent)]" strokeWidth={2.25} />
                    {item}
                  </li>
                ))}
              </ul>
              {showCta ? (
                <div className="mt-8">
                  {isPro ? (
                    <ProCheckoutButton />
                  ) : (
                    <Link href="/signup" className="btn-secondary w-full">
                      Join the waitlist
                    </Link>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mx-auto max-w-4xl">
        <h2 className="title-display text-center text-3xl">Compare plans</h2>
        <div className="mt-8 overflow-x-auto rounded-[18px] border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full min-w-[520px] text-left text-[15px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-[13px] text-[var(--muted)]">
                <th className="px-6 py-4 font-medium">Feature</th>
                <th className="w-32 px-6 py-4 font-medium">Free</th>
                <th className="w-32 px-6 py-4 font-medium">Pro</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-6 py-4 text-[var(--muted-strong)]">{row.label}</td>
                  <td className="px-6 py-4">
                    <Cell value={row.free} />
                  </td>
                  <td className="px-6 py-4">
                    <Cell value={row.pro} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
