"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { SelranoLogo } from "@/components/selrano-logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
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

  const signUpHref = nextPath !== "/dashboard" ? `/signup?next=${encodeURIComponent(nextPath)}` : "/signup";

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-12">
      <section className="panel w-full max-w-md p-8 bg-white shadow-lg space-y-6">
        <div className="flex items-center justify-between">
          <SelranoLogo />
          <span className="badge badge-brand text-[10px]">Secure Login</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Welcome back</h1>
          <p className="mt-1 text-xs text-[var(--muted-strong)]">
            Sign in to continue into your private thinking workspace
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[var(--muted-strong)]">Email Address</label>
            <input
              aria-label="Email address"
              className="input-enterprise mt-1.5 w-full"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--muted-strong)]">Password</label>
              <Link href="/reset-password" className="text-xs text-[var(--muted)] hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              aria-label="Password"
              className="input-enterprise mt-1.5 w-full"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <button className="btn-primary w-full mt-2" type="submit" disabled={loading}>
            <span>{loading ? "Signing in..." : "Sign In"}</span>
            <ArrowRight size={15} />
          </button>

          {message && (
            <p className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs font-semibold text-rose-700">
              {message}
            </p>
          )}
        </form>

        <div className="border-t border-[var(--border)] pt-4 text-center text-xs text-[var(--muted)]">
          Do not have an account?{" "}
          <Link href={signUpHref} className="font-bold text-[var(--text)] hover:underline">
            Create account
          </Link>
        </div>
      </section>
    </main>
  );
}
