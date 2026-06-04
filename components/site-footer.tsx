import Link from "next/link";
import { brand } from "@/lib/brand";

const links = [
  { href: brand.urls.support, label: "Support" },
  { href: brand.urls.security, label: "Security" },
  { href: brand.urls.terms, label: "Terms" },
  { href: brand.urls.privacy, label: "Privacy" }
] as const;

export function SiteFooter({ showHome = true }: { showHome?: boolean }) {
  return (
    <footer className="border-t border-[var(--border)] py-8">
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-sm text-[var(--muted)]">
          © {new Date().getFullYear()} {brand.legalName}. All rights reserved.
        </p>
        <nav className="flex flex-wrap justify-center gap-6 text-sm font-bold text-[var(--muted)]">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-[var(--text)]">
              {link.label}
            </Link>
          ))}
          {showHome ? (
            <Link href="/" className="transition-colors hover:text-[var(--text)]">
              Home
            </Link>
          ) : null}
        </nav>
      </div>
      <p className="mt-4 text-center text-xs text-[var(--muted)]">
        Support:{" "}
        <a href={`mailto:${brand.emails.support}`} className="font-bold text-[var(--muted-strong)] hover:text-[var(--text)]">
          {brand.emails.support}
        </a>
      </p>
    </footer>
  );
}
