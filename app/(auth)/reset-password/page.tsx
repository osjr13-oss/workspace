"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { SelranoLogo } from "@/components/selrano-logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setSuccess(false);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`
      });
      if (error) throw error;
      setSuccess(true);
      setMessage("Password reset email sent. Check your inbox for the secure link.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-12">
      <section className="panel w-full max-w-md p-8 bg-white shadow-lg space-y-6">
        <SelranoLogo />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Reset your password</h1>
          <p className="mt-1 text-xs text-[var(--muted-strong)]">
            Enter your email and we will send a secure link to reset your password.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[var(--muted-strong)]">Email Address</label>
            <input
              aria-label="Email address"
              className="input-enterprise mt-1.5 w-full"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <button className="btn-primary w-full mt-2" type="submit" disabled={loading}>
            <span>{loading ? "Sending link..." : "Send Reset Link"}</span>
            <ArrowRight size={15} />
          </button>

          {message && (
            <p
              className={`rounded-lg border p-2.5 text-xs font-semibold ${
                success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-rose-50 border-rose-200 text-rose-700"
              }`}
            >
              {message}
            </p>
          )}
        </form>

        <div className="border-t border-[var(--border)] pt-4 text-center">
          <Link href="/signin" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text)] hover:underline">
            <ArrowLeft size={13} />
            <span>Back to sign in</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
