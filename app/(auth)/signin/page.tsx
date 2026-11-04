"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthField, AuthFrame } from "@/components/auth-frame";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function safeNextPath(value: string | null) {
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
  const nextPath = safeNextPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
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
    <AuthFrame title="Welcome back" copy="Sign in to pick up where you left off.">
      <form onSubmit={submit} className="space-y-4">
        <AuthField label="Email address" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <div>
          <AuthField label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          <div className="mt-2 text-right">
            <Link href="/reset-password" className="text-[13px] font-medium text-[var(--accent)] hover:underline">
              Forgot your password?
            </Link>
          </div>
        </div>
        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Signing in" : "Sign in"}
        </button>
        {message ? (
          <p role="alert" className="text-sm font-medium text-[var(--critical)]">
            {message}
          </p>
        ) : null}
      </form>
      <p className="mt-8 border-t border-[var(--border)] pt-6 text-sm text-[var(--muted)]">
        New to Selrano? Accounts are paused for now.{" "}
        <Link href="/signup" className="font-medium text-[var(--accent)] hover:underline">
          Join the waitlist
        </Link>
      </p>
    </AuthFrame>
  );
}
