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
      // Clipboard API unavailable — the link is still visible to copy manually.
    }
  }

  if (loading || !status) {
    return (
      <section className="panel p-6">
        <h2 className="text-base font-extrabold tracking-[-0.01em]">Invite classmates</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">Loading your referral link…</p>
      </section>
    );
  }

  const remaining = Math.max(status.required - status.referralCount, 0);

  return (
    <section className="panel p-6">
      <h2 className="flex items-center gap-2 text-base font-extrabold tracking-[-0.01em]">
        <Users size={18} /> Invite classmates
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
        Share your link. When 3 people sign up through it, you get a free month of Pro.
      </p>

      <div className="glass-card mt-5 flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--muted-strong)]">{status.referralLink}</p>
        <button type="button" onClick={copyLink} className="btn-secondary shrink-0">
          {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <span className="status-pill">
          {status.referralCount} / {status.required} referrals
        </span>
        {status.bonusActive ? (
          <span className="status-pill text-[var(--low)]">
            <Gift size={14} /> Pro bonus active{status.bonusUntil ? ` until ${new Date(status.bonusUntil).toLocaleDateString()}` : ""}
          </span>
        ) : remaining > 0 ? (
          <span className="text-sm text-[var(--muted)]">{remaining} more to unlock your free month.</span>
        ) : null}
      </div>
    </section>
  );
}
