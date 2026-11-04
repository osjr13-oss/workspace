import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { guides } from "@/lib/guides";
import { ArrowRight } from "lucide-react";
import { PageIntro } from "@/components/marketing/page-intro";

export const metadata: Metadata = {
  title: "Guides",
  description: `Guides on studying, note-taking, and getting the most out of ${brand.name}.`
};

function formatDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

export default function GuidesPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
      <PageIntro eyebrow="Guides" title="Guides" lede="Notes on studying, note-taking, and comparing tools honestly." />
      <div className="mt-14 border-t border-[var(--border)]">
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            href={`/guides/${guide.slug}`}
            className="group grid gap-2 border-b border-[var(--border)] py-8 sm:grid-cols-[180px_1fr_auto] sm:gap-8"
          >
            <p className="text-sm text-[var(--muted)]">{formatDate(guide.publishedAt)}</p>
            <div>
              <h2 className="font-display text-[26px] font-medium leading-tight tracking-[-0.015em] text-[var(--text)] group-hover:text-[var(--accent)]">
                {guide.title}
              </h2>
              <p className="mt-2 text-[15.5px] leading-[1.7] text-[var(--muted-strong)]">{guide.description}</p>
            </div>
            <ArrowRight size={18} className="mt-2 hidden text-[var(--muted)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--accent)] sm:block" />
          </Link>
        ))}
      </div>
    </div>
  );
}
