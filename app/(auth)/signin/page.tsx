"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { supabaseConfigured } from "@/lib/supabase/config";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/chats";
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNext(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(searchParams.get("error") === "auth" ? "That sign-in link did not work." : "");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabaseConfigured()) {
      setMessage("Sign in is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace(nextPath);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame title="Welcome back" copy="Sign in to continue your chats.">
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
        <input
          aria-label="Password"
          className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <button className="w-full rounded-full bg-[var(--ink)] py-2 text-sm text-white disabled:opacity-60" type="submit" disabled={loading}>
          {loading ? "Signing in" : "Sign in"}
        </button>
        {message ? <p className="text-sm text-red-700">{message}</p> : null}
      </form>
      <div className="mt-5 flex justify-between text-sm">
        <Link href="/signup">Create account</Link>
        <Link href="/reset-password" className="text-[var(--muted)]">
          Reset password
        </Link>
      </div>
    </AuthFrame>
  );
}
