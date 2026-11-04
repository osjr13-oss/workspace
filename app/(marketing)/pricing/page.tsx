import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/marketing/page-intro";
import { PricingTable } from "@/components/pricing-table";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Free and Pro plans for ${brand.name}.`
};

const faqs = [
  {
    q: "Can I cancel Pro?",
    a: "Yes. Cancel or update your card any time from Settings, through Stripe's secure billing portal."
  },
  {
    q: "What is the founding price?",
    a: "An introductory price for early members while Selrano is young."
  },
  {
    q: "Do I need a card for the free plan?",
    a: "No. The free plan needs no payment details. You only add a card if you choose to upgrade."
  }
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
      <PageIntro
        center
        eyebrow="Pricing"
        title="Simple plans for real work."
        lede="Start free. Upgrade when Selrano becomes part of your daily routine and you need more room for projects and files."
      />
      <div className="mt-14">
        <PricingTable />
      </div>

      <section className="mx-auto mt-24 max-w-3xl">
        <h2 className="title-display text-center text-3xl">Billing questions</h2>
        <dl className="mt-8 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {faqs.map((item) => (
            <div key={item.q} className="py-5">
              <dt className="text-[16px] font-medium">{item.q}</dt>
              <dd className="mt-1.5 text-[15px] leading-[1.7] text-[var(--muted-strong)]">{item.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 text-center text-sm text-[var(--muted)]">
          Already have an account?{" "}
          <Link href="/settings" className="font-medium text-[var(--accent)] hover:underline">
            Manage billing in Settings
          </Link>
        </p>
      </section>
    </div>
  );
}
