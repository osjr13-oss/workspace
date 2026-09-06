import Link from "next/link";
import { SelranoLogo } from "@/components/selrano-logo";
import { SiteFooter } from "@/components/site-footer";
import { brand } from "@/lib/brand";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="border-b border-[var(--border)] bg-[rgba(247,245,240,0.84)] backdrop-blur-xl sticky top-0 z-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <SelranoLogo href="/" />
          <nav className="flex flex-wrap gap-6 text-sm font-bold text-[var(--muted)]">
            <Link href="/pricing" className="hover:text-[var(--text)] transition-colors">Pricing</Link>
            <Link href="/guides" className="hover:text-[var(--text)] transition-colors">Guides</Link>
            <Link href="/changelog" className="hover:text-[var(--text)] transition-colors">Changelog</Link>
            <Link href={brand.urls.support} className="hover:text-[var(--text)] transition-colors">Support</Link>
            <Link href={brand.urls.security} className="hover:text-[var(--text)] transition-colors">Security</Link>
            <Link href={brand.urls.terms} className="hover:text-[var(--text)] transition-colors">Terms</Link>
            <Link href={brand.urls.privacy} className="hover:text-[var(--text)] transition-colors">Privacy</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16">
        {children}
      </main>
      <div className="mx-auto max-w-3xl px-6">
        <SiteFooter />
      </div>
    </div>
  );
}
