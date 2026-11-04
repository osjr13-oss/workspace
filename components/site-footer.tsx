import Link from "next/link";
import { SelranoLogo } from "@/components/selrano-logo";
import { brand } from "@/lib/brand";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/#how", label: "How it works" },
      { href: "/#features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: brand.urls.changelog, label: "Changelog" }
    ]
  },
  {
    title: "Learn",
    links: [
      { href: "/guides", label: "Guides" },
      { href: brand.urls.security, label: "Security" }
    ]
  },
  {
    title: "Legal",
    links: [
      { href: brand.urls.privacy, label: "Privacy" },
      { href: brand.urls.terms, label: "Terms" }
    ]
  },
  {
    title: "Account",
    links: [
      { href: "/signin", label: "Sign in" },
      { href: "/signup", label: "Join the waitlist" }
    ]
  }
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-5 pb-10 pt-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.3fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <SelranoLogo />
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
              A calm AI workspace for your own notes, files, and research.
            </p>
          </div>
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="text-[13px] font-medium text-[var(--text)]">{column.title}</p>
              <ul className="mt-3 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--text)]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="mt-12 border-t border-[var(--border)] pt-6 text-[13px] text-[var(--muted)]">
          © {new Date().getFullYear()} {brand.legalName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
