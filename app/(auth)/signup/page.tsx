"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { supabaseConfigured } from "@/lib/supabase/config";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabaseConfigured()) {
      setMessage("Sign up is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${origin}/auth/callback?next=/chats`
        }
      });
      if (error) throw error;
      if (data.session) {
        await fetch("/api/email/welcome", { method: "POST" }).catch(() => undefined);
        router.replace("/chats");
        return;
      }
      setMessage("Check your email to confirm the account, then sign in.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create the account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame title="Create an account" copy="Your threads stay with the account.">
      <form onSubmit={submit} className="space-y-3">
        <input
          aria-label="Name"
          className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
          placeholder="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          aria-label="Email address"
          className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          aria-label="Password"
          className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
          type="password"
          placeholder="Password"
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <button className="w-full rounded-full bg-[var(--ink)] py-2 text-sm text-white disabled:opacity-60" type="submit" disabled={loading}>
          {loading ? "Creating account" : "Create account"}
        </button>
        {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
      </form>
      <p className="mt-5 text-sm">
        <Link href="/signin">Already have an account</Link>
      </p>
    </AuthFrame>
  );
}
