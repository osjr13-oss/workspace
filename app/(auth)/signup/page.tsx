import Link from "next/link";
import { SelranoLogo } from "@/components/selrano-logo";

// Sign-ups are closed (owner decision, 2026-10-21): the site is public, but new
// accounts are turned off in Supabase. The sign-up form is in git history
// (before commit "Close sign-ups while keeping the site public").
export default function SignUpPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="panel w-full max-w-md p-7">
        <SelranoLogo />
        <h1 className="mt-10 text-4xl font-extrabold tracking-[-0.04em]">Sign-ups are closed</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
          Selrano is not taking new accounts right now. If you already have one, you can sign in.
        </p>
        <div className="mt-7 flex gap-3">
          <Link href="/signin" className="btn-primary">Sign in</Link>
          <Link href="/" className="btn-secondary">Back to home</Link>
        </div>
      </section>
    </main>
  );
}
