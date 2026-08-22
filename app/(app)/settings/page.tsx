"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Brain,
  Check,
  CreditCard,
  KeyRound,
  LifeBuoy,
  Mail,
  Save,
  Shield,
  Trash2,
  User,
  Users
} from "lucide-react";
import { BillingSection } from "@/components/billing-section";
import { ReferralSection } from "@/components/referral-section";
import { WorkspaceHeader } from "@/components/workspace-header";
import { MemoryInspectorModal } from "@/components/memory-inspector-modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { removeEmDashes } from "@/lib/text";
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
  const [memoryModalOpen, setMemoryModalOpen] = useState(false);
  const [toneProfile, setToneProfile] = useState<string | null>(null);

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

      const { data: style } = await supabase
        .from("style_profiles")
        .select("directive")
        .eq("user_id", data.user.id)
        .single();
      if (style?.directive) {
        setToneProfile(style.directive);
      }
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
        setMessage(enabled ? "Weekly reflections enabled." : "Weekly reflections disabled.");
        setTimeout(() => setMessage(""), 2500);
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

    const cleanName = removeEmDashes(fullName);
    const { error: authError } = await supabase.auth.updateUser({
      data: { full_name: cleanName }
    });
    if (authError) {
      setMessage(authError.message);
      setSaving(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: cleanName, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    setMessage(profileError ? profileError.message : "Profile updated.");
    setTimeout(() => setMessage(""), 2500);
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-5 py-8 sm:px-8">
      <WorkspaceHeader title="Settings" eyebrow="Workspace & Account" />
      <MemoryInspectorModal
        open={memoryModalOpen}
        onClose={() => setMemoryModalOpen(false)}
      />

      {message && (
        <div className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs">
          {message}
        </div>
      )}

      {/* Profile Section */}
      <form onSubmit={save} className="panel p-6 bg-white space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <User size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text)]">Profile Details</h2>
            <p className="text-xs text-[var(--muted)]">Your account identification details</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold text-[var(--muted-strong)]">Full Name</label>
            <input
              className="input-enterprise mt-1.5 w-full"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--muted-strong)]">Email Address</label>
            <input className="input-enterprise mt-1.5 w-full bg-slate-50 opacity-70" value={email} disabled />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button className="btn-primary" type="submit" disabled={saving}>
            <Save size={15} />
            <span>{saving ? "Saving..." : "Save Profile"}</span>
          </button>
        </div>
      </form>

      {/* Durable Memory & Intelligence Control */}
      <section className="panel p-6 bg-white space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Brain size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text)]">Durable Memory Bank</h2>
              <p className="text-xs text-[var(--muted)]">
                Manage learned facts, preferences, and writing tone directives
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMemoryModalOpen(true)}
            className="btn-secondary min-h-[34px] px-3 text-xs"
          >
            Inspect Memory Bank
          </button>
        </div>

        {toneProfile && (
          <div className="rounded-xl border border-[var(--border)] bg-slate-50 p-3.5 text-xs">
            <span className="font-bold text-[var(--text)]">Active Writing Tone Directive:</span>
            <p className="mt-1 text-[var(--muted-strong)] leading-relaxed">{toneProfile}</p>
          </div>
        )}
      </section>

      {/* Billing & Subscription */}
      <BillingSection />

      {/* Referrals */}
      <ReferralSection />

      {/* Email Preferences */}
      <section className="panel p-6 bg-white space-y-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Mail size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text)]">Email Preferences</h2>
            <p className="text-xs text-[var(--muted)]">
              Weekly memory reflection summaries and essential account updates
            </p>
          </div>
        </div>

        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-slate-50 p-4 transition hover:bg-slate-100">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            checked={lifecycleEmails}
            disabled={savingEmailPrefs}
            onChange={(event) => toggleLifecycleEmails(event.target.checked)}
          />
          <div className="text-xs">
            <span className="font-bold text-[var(--text)]">
              Weekly Memory Reflection Digest
            </span>
            <p className="mt-0.5 text-[var(--muted-strong)] leading-relaxed">
              Receive a private synthesized digest of your thinking threads and key takeaways every week.
            </p>
          </div>
        </label>
      </section>

      {/* Security & Password */}
      <section className="panel p-6 bg-white space-y-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Shield size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text)]">Security & Password</h2>
            <p className="text-xs text-[var(--muted)]">
              Request a secure password reset link sent to your registered email
            </p>
          </div>
        </div>

        <div className="pt-2">
          <Link href="/reset-password" className="btn-secondary">
            <KeyRound size={15} />
            <span>Send Password Reset Email</span>
          </Link>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="panel p-6 bg-white border-rose-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
            <Trash2 size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-rose-700">Delete Account & Data</h2>
            <p className="text-xs text-[var(--muted)]">
              Permanently remove your account, thoughts, notes, and uploaded files
            </p>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-[var(--muted-strong)]">
          Once deleted, your active subscription is immediately cancelled, storage objects are removed, and your data cannot be recovered.
        </p>

        <div className="pt-2">
          <button
            type="button"
            className="btn-secondary text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
            disabled={deletingAccount}
            onClick={async () => {
              if (
                !confirm(
                  "Are you absolutely certain? This will permanently delete your account and all data. This action is irreversible."
                )
              )
                return;
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
            <Trash2 size={15} />
            <span>{deletingAccount ? "Deleting account..." : "Delete my account permanently"}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
