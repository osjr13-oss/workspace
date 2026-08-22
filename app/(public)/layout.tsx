import Link from "next/link";
import { SelranoLogo } from "@/components/selrano-logo";
import { SiteFooter } from "@/components/site-footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[rgba(247,245,240,0.84)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <SelranoLogo href="/" />
          <nav className="flex flex-wrap gap-6 text-sm font-bold text-[var(--muted)]">
            <Link href="/library" className="hover:text-[var(--text)] transition-colors">Library</Link>
            <Link href="/pricing" className="hover:text-[var(--text)] transition-colors">Pricing</Link>
            <Link href="/guides" className="hover:text-[var(--text)] transition-colors">Guides</Link>
            <Link href="/changelog" className="hover:text-[var(--text)] transition-colors">Changelog</Link>
            <Link href="/support" className="hover:text-[var(--text)] transition-colors">Support</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16">
        {children}
      </main>
      <div className="mx-auto max-w-5xl px-6">
        <SiteFooter />
      </div>
    </div>
  );
}
