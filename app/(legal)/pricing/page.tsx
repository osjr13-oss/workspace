import type { Metadata } from "next";
import Link from "next/link";
import { PricingTable } from "@/components/pricing-table";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Simple Free and Pro plans for ${brand.name}.`
};

export default function PricingPage() {
  return (
    <article>
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Pricing</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
        Simple plans for daily thinking
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--muted-strong)]">
        Start free with 5 durable memories and standard thinking tools. Upgrade to Pro when you want an unlimited memory bank, deep cross-conversation recall, and room for all your projects. Cancel anytime.
      </p>

      <div className="mt-10">
        <PricingTable />
      </div>

      <p className="mt-8 text-xs text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/settings" className="font-bold text-[var(--text)] underline">
          Manage billing in Settings
        </Link>
        .
      </p>
    </article>
  );
}
