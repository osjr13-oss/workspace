"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthField, AuthFrame } from "@/components/auth-frame";
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
      router.replace("/chats");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame title="Choose a new password" copy="Use at least 8 characters.">
      <form onSubmit={submit} className="space-y-4">
        <AuthField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
        />
        <AuthField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          required
          minLength={8}
        />
        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Saving" : "Update password"}
        </button>
        {message ? (
          <p role="alert" className="text-sm font-medium text-[var(--critical)]">
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
