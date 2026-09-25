"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { supabaseConfigured } from "@/lib/supabase/config";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabaseConfigured()) {
      setMessage("Password reset is not configured. Add the Supabase URL and anon key.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`
      });
      if (error) throw error;
      setMessage("If that account exists, a reset link is on its way.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send the reset email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame title="Reset password" copy="We email you a link. It does not reveal whether the account exists beyond what Supabase returns.">
      <form onSubmit={submit} className="space-y-3">
        <input
          aria-label="Email address"
          className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <button className="w-full rounded-full bg-[var(--ink)] py-2 text-sm text-white disabled:opacity-60" type="submit" disabled={loading}>
          {loading ? "Sending" : "Send reset link"}
        </button>
        {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
      </form>
      <p className="mt-5 text-sm">
        <Link href="/signin">Back to sign in</Link>
      </p>
    </AuthFrame>
  );
}
