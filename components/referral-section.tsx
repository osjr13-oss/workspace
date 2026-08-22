"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Copy, Gift, Users } from "lucide-react";

type ReferralStatus = {
  referralCode: string;
  referralLink: string;
  referralCount: number;
  required: number;
  bonusActive: boolean;
  bonusUntil: string | null;
};

export function ReferralSection() {
  const [status, setStatus] = useState<ReferralStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/referrals")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setStatus(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function copyLink() {
    if (!status) return;
    try {
      await navigator.clipboard.writeText(status.referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable fallback
    }
  }

  if (loading || !status) {
    return (
      <section className="panel p-6 bg-white shadow-sm">
        <h2 className="text-sm font-bold text-[var(--text)]">Invite & Referrals</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">Loading referral link...</p>
      </section>
    );
  }

  const remaining = Math.max(status.required - status.referralCount, 0);

  return (
    <section className="panel p-6 bg-white shadow-sm space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
          <Users size={16} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[var(--text)]">Invite Colleagues & Friends</h2>
          <p className="text-xs text-[var(--muted)]">
            When 3 people sign up using your link, you unlock 1 month of Pro access
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-slate-50 p-2.5">
        <p className="min-w-0 flex-1 truncate px-2 font-mono text-xs text-[var(--muted-strong)]">
          {status.referralLink}
        </p>
        <button
          type="button"
          onClick={copyLink}
          className="btn-secondary min-h-[32px] px-3 text-xs"
        >
          {copied ? <CheckCircle size={14} className="text-emerald-600" /> : <Copy size={14} />}
          <span>{copied ? "Copied" : "Copy link"}</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="badge badge-brand text-xs">
          {status.referralCount} / {status.required} referrals completed
        </span>
        {status.bonusActive ? (
          <span className="badge badge-success text-xs">
            <Gift size={13} />
            <span>
              Pro bonus active
              {status.bonusUntil
                ? ` until ${new Date(status.bonusUntil).toLocaleDateString()}`
                : ""}
            </span>
          </span>
        ) : remaining > 0 ? (
          <span className="text-xs text-[var(--muted)]">
            {remaining} more needed to activate your free month.
          </span>
        ) : null}
      </div>
    </section>
  );
}
