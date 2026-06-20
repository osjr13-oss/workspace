import Link from "next/link";
import { SelranoLogo } from "@/components/selrano-logo";

export function LaunchNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-[rgba(255,255,255,0.45)] bg-[rgba(247,245,240,0.72)] backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6">
        <SelranoLogo />
        <nav className="hidden items-center gap-6 text-sm font-bold text-[var(--muted)] sm:flex">
          <a href="#demo" className="transition-colors hover:text-[var(--text)]">
            How it works
          </a>
          <a href="#acts" className="transition-colors hover:text-[var(--text)]">
            Features
          </a>
          <Link href="/pricing" className="transition-colors hover:text-[var(--text)]">
            Pricing
          </Link>
          <Link href="/signin" className="transition-colors hover:text-[var(--text)]">
            Sign in
          </Link>
          <Link href="/signup" className="btn-primary">
            Start free
          </Link>
        </nav>
        <Link href="/signup" className="btn-primary sm:hidden">
          Start
        </Link>
      </div>
    </header>
  );
}
