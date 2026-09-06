import Link from "next/link";
import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { guides } from "@/lib/guides";

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
    <article>
      <p className="text-sm font-bold text-[var(--muted)]">Guides</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.035em] text-[var(--text)]">Guides</h1>
      <p className="mt-4 text-base leading-7 text-[var(--muted-strong)]">
        Notes on studying, note-taking, and comparing tools honestly.
      </p>

      <div className="mt-12 space-y-8">
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            href={`/guides/${guide.slug}`}
            className="panel block p-6 hover:border-[var(--border-strong)]"
          >
            <p className="text-sm font-bold text-[var(--muted)]">{formatDate(guide.publishedAt)}</p>
            <h2 className="mt-2 text-xl font-extrabold tracking-[-0.02em] text-[var(--text)]">{guide.title}</h2>
            <p className="mt-2 text-base leading-7 text-[var(--muted-strong)]">{guide.description}</p>
          </Link>
        ))}
      </div>
    </article>
  );
}
