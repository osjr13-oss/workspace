"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { SelranoLogo } from "@/components/selrano-logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { removeEmDashes } from "@/lib/text";

const REFERRAL_COOKIE = "selrano_ref";

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref") || "";
  const nextPath = safeNextPath(searchParams.get("next"));

  useEffect(() => {
    if (!ref) return;
    document.cookie = `${REFERRAL_COOKIE}=${encodeURIComponent(ref)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  }, [ref]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setSuccess(false);
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectParams = new URLSearchParams({ next: nextPath });
      if (ref) redirectParams.set("ref", ref);

      const cleanName = removeEmDashes(fullName);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: cleanName },
          emailRedirectTo: `${window.location.origin}/auth/callback?${redirectParams.toString()}`
        }
      });
      if (error) throw error;

      if (!data.session) {
        setSuccess(true);
        setMessage("Check your email to confirm your account, then sign in.");
        return;
      }

      try {
        const welcomeResponse = await fetch("/api/email/welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: cleanName })
        });
        if (!welcomeResponse.ok) {
          console.error("[signup] Welcome email delivery failed", welcomeResponse.statusText);
        }
      } catch (welcomeError) {
        console.error("[signup] Welcome email delivery failed", welcomeError);
      }

      if (ref) {
        try {
          await fetch("/api/referrals/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: ref })
          });
        } catch (referralError) {
          console.error("[signup] Referral capture failed", referralError);
        }
      }

      router.replace(nextPath);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create account.");
    } finally {
      setLoading(false);
    }
  }

  const signInHref = nextPath !== "/dashboard" ? `/signin?next=${encodeURIComponent(nextPath)}` : "/signin";

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-12">
      <section className="panel w-full max-w-md p-8 bg-white shadow-lg space-y-6">
        <div className="flex items-center justify-between">
          <SelranoLogo />
          <span className="badge badge-brand text-[10px]">Free Workspace</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Create your workspace</h1>
          <p className="mt-1 text-xs text-[var(--muted-strong)]">
            Start thinking with durable memory and grounded citations
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[var(--muted-strong)]">Full Name</label>
            <input
              aria-label="Full name"
              className="input-enterprise mt-1.5 w-full"
              placeholder="e.g. Alex Morgan"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          </div>

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
            <label className="text-xs font-bold text-[var(--muted-strong)]">Password</label>
            <input
              aria-label="Password"
              className="input-enterprise mt-1.5 w-full"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
          </div>

          <button className="btn-primary w-full mt-2" type="submit" disabled={loading}>
            <span>{loading ? "Creating workspace..." : "Create Free Account"}</span>
            <ArrowRight size={15} />
          </button>

          {message && (
            <p
              className={`rounded-lg border p-2.5 text-xs font-semibold ${
                success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-rose-50 border-rose-200 text-rose-700"
              }`}
            >
              {message}
            </p>
          )}
        </form>

        <div className="border-t border-[var(--border)] pt-4 text-center text-xs text-[var(--muted)]">
          Already have an account?{" "}
          <Link href={signInHref} className="font-bold text-[var(--text)] hover:underline">
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
