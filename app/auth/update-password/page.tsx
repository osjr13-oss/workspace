"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SelranoLogo } from "@/components/selrano-logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.replace("/dashboard");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="panel w-full max-w-md p-7">
        <SelranoLogo />
        <h1 className="mt-10 text-4xl font-extrabold tracking-[-0.04em]">Set new password</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
          Choose a new password for your account.
        </p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <input
            aria-label="New password"
            className="input-premium w-full px-5"
            type="password"
            placeholder="New password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
          <input
            aria-label="Confirm password"
            className="input-premium w-full px-5"
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
            minLength={8}
          />
          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? "Saving" : "Update password"}
          </button>
          {message ? <p className="text-sm font-bold text-[var(--critical)]">{message}</p> : null}
        </form>
        <Link href="/signin" className="mt-6 inline-block text-sm font-bold text-[var(--text)]">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
