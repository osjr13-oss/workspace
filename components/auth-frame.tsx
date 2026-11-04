import Link from "next/link";
import { SelranoLogo } from "@/components/selrano-logo";
import { CitationVignette } from "@/components/marketing/vignettes";

/** Shared layout for sign in, password reset, and the closed sign-up page. */
export function AuthFrame({ title, copy, children }: { title: string; copy: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-h-screen flex-col px-5 py-6 sm:px-10">
        <SelranoLogo />
        <div className="flex flex-1 items-center py-12">
          <section className="mx-auto w-full max-w-[400px]">
            <h1 className="title-display text-[40px] sm:text-[44px]">{title}</h1>
            <div className="mt-3 text-[15px] leading-[1.65] text-[var(--muted-strong)]">{copy}</div>
            <div className="mt-8">{children}</div>
          </section>
        </div>
        <nav className="flex gap-5 text-[13px] text-[var(--muted)]" aria-label="Legal">
          <Link href="/" className="hover:text-[var(--text)]">
            Home
          </Link>
          <Link href="/privacy" className="hover:text-[var(--text)]">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[var(--text)]">
            Terms
          </Link>
        </nav>
      </div>
      <aside className="relative hidden overflow-hidden p-3 lg:block" aria-hidden="true">
        <div className="relative flex h-full flex-col justify-center overflow-hidden rounded-[28px] bg-[var(--accent)] px-14 py-16">
          <div className="pointer-events-none absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(236,212,138,0.22),transparent_65%)]" />
          <p className="max-w-md font-display text-[40px] font-medium leading-[1.1] tracking-[-0.02em] text-white">
            Every answer points back to the page it came from.
          </p>
          <div className="mt-10 max-w-md">
            <CitationVignette />
          </div>
        </div>
      </aside>
    </main>
  );
}

export function AuthField({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted-strong)]">{label}</span>
      <input className="input-premium w-full px-4" {...props} />
    </label>
  );
}
