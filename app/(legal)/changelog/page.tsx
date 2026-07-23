import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { changelog } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Changelog",
  description: `What's new in ${brand.name}.`
};

const tagStyles: Record<string, string> = {
  New: "bg-[var(--text)] text-white",
  Improved: "bg-[var(--info)]/15 text-[var(--info)]",
  Fixed: "bg-[var(--low)]/15 text-[var(--low)]"
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
    <article className="prose-meridian">
      <p className="text-sm font-bold text-[var(--muted)]">Changelog</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.035em] text-[var(--text)]">What&apos;s new in {brand.name}</h1>
      <p className="mt-4 text-base text-[var(--muted-strong)]">
        A running record of features and improvements as they ship.
      </p>

      <div className="mt-12 space-y-10">
        {changelog.map((entry, index) => (
          <section key={`${entry.date}-${index}`} className="border-b border-[var(--border)] pb-10 last:border-none">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-bold text-[var(--muted)]">{formatDate(entry.date)}</p>
              {entry.tag ? (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${tagStyles[entry.tag] || "bg-[var(--surface-subtle)] text-[var(--muted-strong)]"}`}>
                  {entry.tag}
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 text-xl font-extrabold tracking-[-0.02em] text-[var(--text)]">{entry.title}</h2>
            <p className="mt-2 text-base leading-7 text-[var(--muted-strong)]">{entry.description}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
