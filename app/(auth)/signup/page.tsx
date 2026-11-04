import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { WaitlistForm } from "@/components/marketing/waitlist-form";

export const metadata: Metadata = { title: "Join the waitlist" };

// Sign-ups are closed (owner decision, 2026-10-21): the site is public, but new
// accounts are turned off in Supabase. Visitors can join the waitlist instead
// (app/api/waitlist). The old sign-up form is in git history (before commit
// "Close sign-ups while keeping the site public").
export default function SignUpPage() {
  return (
    <AuthFrame
      title="Sign-ups are closed for now"
      copy="Selrano is not taking new accounts yet. Leave your email and we will let you know as soon as it opens."
    >
      <WaitlistForm />
      <p className="mt-8 border-t border-[var(--border)] pt-6 text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/signin" className="font-medium text-[var(--accent)] hover:underline">
          Sign in
        </Link>
      </p>
    </AuthFrame>
  );
}
