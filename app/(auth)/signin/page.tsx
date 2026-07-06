"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SelranoLogo } from "@/components/selrano-logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function SignInPage() {
  const router = useRouter();
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
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next?.startsWith("/") ? next : "/dashboard");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame title="Welcome back" copy="Sign in to continue organizing your work.">
      <form onSubmit={submit} className="space-y-4">
        <input aria-label="Email address" className="input-premium w-full px-5" type="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <input aria-label="Password" className="input-premium w-full px-5" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Signing in" : "Sign in"}
        </button>
        {message ? <p className="text-sm font-bold text-[var(--critical)]">{message}</p> : null}
      </form>
      <div className="mt-6 flex items-center justify-between text-sm text-[var(--muted)]">
        <Link href="/signup" className="font-bold text-[var(--text)]">Create account</Link>
        <Link href="/reset-password">Reset password</Link>
      </div>
    </AuthFrame>
  );
}

function AuthFrame({ title, copy, children }: { title: string; copy: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="panel w-full max-w-md p-7">
        <SelranoLogo />
        <h1 className="mt-10 text-4xl font-extrabold tracking-[-0.04em]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">{copy}</p>
        <div className="mt-7">{children}</div>
      </section>
    </main>
  );
}
