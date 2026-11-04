import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { changelog } from "@/lib/changelog";
import { PageIntro } from "@/components/marketing/page-intro";

export const metadata: Metadata = {
  title: "Changelog",
  description: `What's new in ${brand.name}.`
};

const tagStyles: Record<string, string> = {
  New: "bg-[var(--accent)] text-[var(--on-accent)]",
  Improved: "bg-[var(--accent-soft-strong)] text-[var(--accent)]",
  Fixed: "bg-[rgba(31,115,80,0.12)] text-[var(--low)]"
};

function formatDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
      <PageIntro eyebrow="Changelog" title={<>What&apos;s new in {brand.name}</>} lede="A running record of features and improvements as they ship." />
      <ol className="mt-14 border-t border-[var(--border)]">
        {changelog.map((entry, index) => (
          <li key={`${entry.date}-${index}`} className="grid gap-3 border-b border-[var(--border)] py-9 sm:grid-cols-[180px_1fr] sm:gap-8">
            <div className="flex items-center gap-3 sm:block">
              <p className="text-sm text-[var(--muted)]">{formatDate(entry.date)}</p>
              {entry.tag ? (
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium sm:mt-2 ${tagStyles[entry.tag] || "bg-[var(--surface-subtle)] text-[var(--muted-strong)]"}`}>
                  {entry.tag}
                </span>
              ) : null}
            </div>
            <div>
              <h2 className="font-display text-[24px] font-medium leading-tight tracking-[-0.015em] text-[var(--text)]">{entry.title}</h2>
              <p className="mt-2 text-[15.5px] leading-[1.7] text-[var(--muted-strong)]">{entry.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
