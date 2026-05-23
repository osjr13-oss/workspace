"use client";

import Link from "next/link";
import { useState } from "react";
import { MeridianLogo } from "@/components/meridian-logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/settings`
      });
      if (error) throw error;
      setMessage("Password reset email sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="panel w-full max-w-md p-7">
        <MeridianLogo />
        <h1 className="mt-10 text-4xl font-extrabold tracking-[-0.04em]">Reset password</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">Enter your email and Supabase will send a secure reset link.</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <input aria-label="Email address" className="input-premium w-full px-5" type="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? "Sending" : "Send reset link"}
          </button>
          {message ? <p className="text-sm font-bold text-[var(--muted-strong)]">{message}</p> : null}
        </form>
        <Link href="/signin" className="mt-6 inline-block text-sm font-bold text-[var(--text)]">Back to sign in</Link>
      </section>
    </main>
  );
}
