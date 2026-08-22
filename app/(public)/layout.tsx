import Link from "next/link";
import { SelranoLogo } from "@/components/selrano-logo";
import { SiteFooter } from "@/components/site-footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <SelranoLogo href="/" />
          <nav className="hidden sm:flex flex-wrap items-center gap-6 text-xs font-bold text-[var(--muted)]">
            <Link href="/pricing" className="hover:text-[var(--text)] transition-colors">Pricing</Link>
            <Link href="/changelog" className="hover:text-[var(--text)] transition-colors">Changelog</Link>
            <Link href="/support" className="hover:text-[var(--text)] transition-colors">Support</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-12">
        {children}
      </main>
      <div className="mx-auto max-w-5xl px-6">
        <SiteFooter />
      </div>
    </div>
  );
}
