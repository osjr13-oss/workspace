import Link from "next/link";
import { SelranoLogo } from "@/components/selrano-logo";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="border-b border-[var(--border)] bg-[rgba(247,245,240,0.84)] backdrop-blur-xl sticky top-0 z-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <SelranoLogo href="/" />
          <nav className="flex gap-6 text-sm font-bold text-[var(--muted)]">
            <Link href="/terms" className="hover:text-[var(--text)] transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-[var(--text)] transition-colors">Privacy</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16">
        {children}
      </main>
      <footer className="border-t border-[var(--border)] py-8 text-center text-sm text-[var(--muted)]">
        <p>© {new Date().getFullYear()} Selrano. All rights reserved.</p>
        <div className="mt-2 flex justify-center gap-6">
          <Link href="/terms" className="hover:text-[var(--text)] transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-[var(--text)] transition-colors">Privacy Policy</Link>
          <Link href="/" className="hover:text-[var(--text)] transition-colors">Home</Link>
        </div>
      </footer>
    </div>
  );
}
