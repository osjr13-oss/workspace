"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthField, AuthFrame } from "@/components/auth-frame";
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
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`
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
    <AuthFrame title="Reset your password" copy="Enter the email on your account and we will send you a secure link to choose a new password.">
      <form onSubmit={submit} className="space-y-4">
        <AuthField label="Email address" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Sending" : "Send reset link"}
        </button>
        {message ? (
          <p role="status" className="text-sm font-medium text-[var(--muted-strong)]">
            {message}
          </p>
        ) : null}
      </form>
      <Link href="/signin" className="mt-8 inline-block text-sm font-medium text-[var(--accent)] hover:underline">
        Back to sign in
      </Link>
    </AuthFrame>
  );
}
