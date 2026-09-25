"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { supabaseConfigured } from "@/lib/supabase/config";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabaseConfigured()) {
      setMessage("Supabase is not configured.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.replace("/chats");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update the password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame title="Choose a new password" copy="Use the link from your email, then set a password here.">
      <form onSubmit={submit} className="space-y-3">
        <input
          aria-label="New password"
          className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
          type="password"
          placeholder="New password"
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <button className="w-full rounded-full bg-[var(--ink)] py-2 text-sm text-white disabled:opacity-60" type="submit" disabled={loading}>
          {loading ? "Saving" : "Save password"}
        </button>
        {message ? <p className="text-sm text-red-700">{message}</p> : null}
      </form>
    </AuthFrame>
  );
}
