import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { ProWaitlistForm } from "@/components/pro-waitlist-form";
import { SelranoLogo } from "@/components/selrano-logo";
import { SiteFooter } from "@/components/site-footer";
import { brand } from "@/lib/brand";
import { PLANS } from "@/lib/plans";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: `Pro waitlist - ${brand.name}`,
  description: `Join the ${brand.name} Pro waitlist for unlimited client workspaces, larger uploads, and ${PLANS.pro.dailyAiRequests} AI messages per day.`
};

const perks = [
  `${PLANS.pro.dailyAiRequests} AI messages per day`,
  "Unlimited client workspaces and brief decks",
  `${PLANS.pro.maxFileMb} MB file uploads`,
  "Semantic search across your client materials",
  "Same notes, review, and client-aware chat"
];

export default async function ProWaitlistPage() {
  const { user } = await getAuthenticatedUser();

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[rgba(247,245,240,0.84)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-6">
          <SelranoLogo href="/" />
          <Link href="/pricing" className="text-sm font-bold text-[var(--muted)] hover:text-[var(--text)]">
            View pricing
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-16 pt-12 sm:px-6 sm:pt-16">
        <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] hover:text-[var(--text)]">
          <ArrowLeft size={16} />
          Back to pricing
        </Link>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
              <Sparkles size={14} />
              Pro waitlist - ${PLANS.pro.priceMonthly}/mo
            </p>
            <h1 className="mt-6 max-w-xl text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] text-balance sm:text-5xl">
              Client work without hitting your limits.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[var(--muted-strong)] sm:text-lg">
              {brand.name} brings client files, notes, briefs, decisions, and AI chat into one calm workspace so you can
              keep every engagement moving.
            </p>
            <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--muted)]">
              Pro is opening soon. Join the waitlist and we&apos;ll let you know when you can upgrade for heavier client
              loads and bigger files.
            </p>

            <ul className="mt-8 space-y-3">
              {perks.map((perk) => (
                <li key={perk} className="flex items-start gap-3 text-sm text-[var(--muted-strong)]">
                  <Check size={16} className="mt-0.5 shrink-0 text-[var(--low)]" />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:sticky lg:top-24">
            <ProWaitlistForm defaultEmail={user?.email || ""} />
            <p className="mt-5 text-center text-sm text-[var(--muted)]">
              Already using Selrano?{" "}
              <Link href="/signup" className="font-bold text-[var(--text)]">
                Start free
              </Link>{" "}
              while you wait.
            </p>
          </div>
        </div>
      </main>

      <div className="mx-auto max-w-5xl px-5 sm:px-6">
        <SiteFooter />
      </div>
    </div>
  );
}
