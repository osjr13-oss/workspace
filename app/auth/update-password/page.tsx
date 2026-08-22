"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
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
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-12">
      <section className="panel w-full max-w-md p-8 bg-white shadow-lg space-y-6">
        <SelranoLogo />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Set new password</h1>
          <p className="mt-1 text-xs text-[var(--muted-strong)]">
            Choose a new secure password for your Selrano workspace.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[var(--muted-strong)]">New Password</label>
            <input
              aria-label="New password"
              className="input-enterprise mt-1.5 w-full"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--muted-strong)]">Confirm New Password</label>
            <input
              aria-label="Confirm password"
              className="input-enterprise mt-1.5 w-full"
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
              minLength={8}
            />
          </div>

          <button className="btn-primary w-full mt-2" type="submit" disabled={loading}>
            <span>{loading ? "Updating password..." : "Update Password"}</span>
            <ArrowRight size={15} />
          </button>

          {message && (
            <p className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs font-semibold text-rose-700">
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
