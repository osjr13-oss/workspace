import type { Metadata } from "next";
import Link from "next/link";
import { PricingTable } from "@/components/pricing-table";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Free and Pro plans for ${brand.name}.`
};

export default function PricingPage() {
  return (
    <article>
      <p className="text-sm font-bold text-[var(--muted)]">Pricing</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.035em]">Simple plans for real work</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted-strong)]">
        Start free. Upgrade when you need more AI capacity, projects, and larger file uploads. Cancel anytime.
      </p>

      <div className="mt-10">
        <PricingTable />
      </div>

      <p className="mt-8 text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/settings" className="font-bold text-[var(--text)]">
          Manage billing in Settings
        </Link>
        .
      </p>
    </article>
  );
}
