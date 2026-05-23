"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email || "");
      setFullName(data.user?.user_metadata?.full_name || "");
    });
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
    setMessage(error ? error.message : "Profile updated.");
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title="Settings" eyebrow="Account" />
      <form onSubmit={save} className="panel space-y-4 p-6">
        <div>
          <label className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">Full name</label>
          <input className="input-premium mt-2 w-full px-5" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" />
        </div>
        <div>
          <label className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">Email</label>
          <input className="input-premium mt-2 w-full px-5" value={email} disabled />
        </div>
        <button className="btn-primary" type="submit" disabled={saving}>
          <Save size={18} />
          {saving ? "Saving" : "Save profile"}
        </button>
        {message ? <p className="text-sm font-bold text-[var(--muted-strong)]">{message}</p> : null}
      </form>

      <section className="panel p-6">
        <h2 className="text-base font-extrabold tracking-[-0.01em]">Security</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">Password reset is handled by Supabase email links.</p>
        <Link href="/reset-password" className="btn-secondary mt-5">Send reset email</Link>
      </section>

      <section className="panel p-6">
        <h2 className="text-base font-extrabold tracking-[-0.01em]">AI configuration</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
          Groq runs server-side through `GROQ_API_KEY` and `GROQ_MODEL`. Secrets are never shown in the browser.
        </p>
      </section>
    </div>
  );
}
