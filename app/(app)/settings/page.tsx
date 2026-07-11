"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { BillingSection } from "@/components/billing-section";
import { WorkspaceHeader } from "@/components/workspace-header";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [lifecycleEmails, setLifecycleEmails] = useState(false);
  const [savingEmailPrefs, setSavingEmailPrefs] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data }) => {
      setEmail(data.user?.email || "");
      const metadataName = data.user?.user_metadata?.full_name || "";
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, lifecycle_emails")
        .eq("id", data.user.id)
        .single();
      setFullName(profile?.full_name || metadataName);
      setLifecycleEmails(profile?.lifecycle_emails === true);
    });
  }, []);

  async function toggleLifecycleEmails(enabled: boolean) {
    setSavingEmailPrefs(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        setMessage("You must be signed in.");
        return;
      }

      const response = await fetch("/api/account/email-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lifecycleEmails: enabled })
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setMessage(payload?.error || "Could not update email preferences.");
      } else {
        setLifecycleEmails(enabled);
        setMessage(enabled ? "Tips & reminders enabled." : "Tips & reminders turned off.");
      }
    } catch {
      setMessage("Could not update email preferences. Please try again.");
    } finally {
      setSavingEmailPrefs(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      setMessage("You must be signed in to save.");
      setSaving(false);
      return;
    }

    const { error: authError } = await supabase.auth.updateUser({ data: { full_name: fullName } });
    if (authError) {
      setMessage(authError.message);
      setSaving(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    setMessage(profileError ? profileError.message : "Profile updated.");
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title="Settings" eyebrow="Account" />
      <BillingSection />
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
        <h2 className="text-base font-extrabold tracking-[-0.01em]">Email preferences</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
          Occasional tips about features and things to try in your workspace. Welcome and support emails are always sent when relevant.
        </p>
        <label className="mt-5 flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-[var(--border)]"
            checked={lifecycleEmails}
            disabled={savingEmailPrefs}
            onChange={(event) => toggleLifecycleEmails(event.target.checked)}
          />
          <span className="text-sm font-semibold">Send tips & feature reminders</span>
        </label>
      </section>

      <section className="panel p-6">
        <h2 className="text-base font-extrabold tracking-[-0.01em]">Help & support</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
          Questions, billing, or account issues — our team typically responds within one business day.
        </p>
        <Link href="/help" className="btn-secondary mt-5">
          Open help center
        </Link>
      </section>

      <section className="panel p-6">
        <h2 className="text-base font-extrabold tracking-[-0.01em]">Security</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
          Request a reset link by email. After you click the link, you will set a new password on a secure page.
        </p>
        <Link href="/reset-password" className="btn-secondary mt-5">Send reset email</Link>
      </section>

      <section className="panel p-6">
        <h2 className="text-base font-extrabold tracking-[-0.01em] text-[var(--critical)]">Danger zone</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
          Permanently delete your account and all your data. This cannot be undone.
        </p>
        <button
          type="button"
          className="btn-secondary mt-5 text-[var(--critical)]"
          disabled={deletingAccount}
          onClick={async () => {
            if (!confirm("Are you absolutely sure? This will permanently delete your account and ALL your data. This cannot be undone.")) return;
            setDeletingAccount(true);
            const res = await fetch("/api/account/delete", { method: "DELETE" });
            if (res.ok) {
              const supabase = createSupabaseBrowserClient();
              await supabase.auth.signOut();
              router.push("/");
            } else {
              const payload = await res.json();
              setMessage(payload.error || "Failed to delete account.");
              setDeletingAccount(false);
            }
          }}
        >
          <Trash2 size={16} />
          {deletingAccount ? "Deleting…" : "Delete my account"}
        </button>
      </section>

    </div>
  );
}
