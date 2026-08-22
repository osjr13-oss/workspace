import Link from "next/link";
import { brand } from "@/lib/brand";

const links = [
  { href: "/pricing", label: "Pricing" },
  { href: "/changelog", label: "Changelog" },
  { href: "/support", label: "Support" },
  { href: "/security", label: "Security" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" }
] as const;

export function SiteFooter({ showHome = true }: { showHome?: boolean }) {
  return (
    <footer className="border-t border-[var(--border)] py-8">
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-xs text-[var(--muted)]">
          © {new Date().getFullYear()} {brand.legalName}. All rights reserved.
        </p>
        <nav className="flex flex-wrap justify-center gap-6 text-xs font-semibold text-[var(--muted)]">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-[var(--text)]">
              {link.label}
            </Link>
          ))}
          {showHome && (
            <Link href="/" className="transition-colors hover:text-[var(--text)]">
              Home
            </Link>
          )}
        </nav>
      </div>
      <p className="mt-3 text-center text-xs text-[var(--muted)]">
        Support:{" "}
        <a href={`mailto:${brand.emails.support}`} className="font-semibold text-[var(--text)] hover:underline">
          {brand.emails.support}
        </a>
      </p>
    </footer>
  );
}
