"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SelranoLogo } from "@/components/selrano-logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
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
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      });
      if (error) throw error;
      fetch("/api/email/welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fullName })
      }).catch(() => undefined);
      router.replace("/dashboard");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="panel w-full max-w-md p-7">
        <SelranoLogo />
        <h1 className="mt-10 text-4xl font-extrabold tracking-[-0.04em]">Create your workspace</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">Start with email and password. No billing is required.</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <input aria-label="Full name" className="input-premium w-full px-5" placeholder="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          <input aria-label="Email address" className="input-premium w-full px-5" type="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <input aria-label="Password" className="input-premium w-full px-5" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? "Creating" : "Create account"}
          </button>
          {message ? <p className="text-sm font-bold text-[var(--critical)]">{message}</p> : null}
        </form>
        <p className="mt-6 text-sm text-[var(--muted)]">
          Already have an account?{" "}
          <Link href="/signin" className="font-bold text-[var(--text)]">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
