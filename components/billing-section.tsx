"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CreditCard, Crown } from "lucide-react";
import { PLANS } from "@/lib/plans";

type BillingStatus = {
  tier: "free" | "pro";
  planName: string;
  priceMonthly: number;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  limits: {
    dailyAiRequests: number;
    maxProjects: number | null;
    maxFileMb: number;
    maxDecks: number | null;
  };
  usage: {
    aiToday: number;
    projects: number;
    decks: number;
  };
  stripeConfigured: boolean;
};

type ReferralStatus = {
  referralLink: string;
  referralCount: number;
  required: number;
  bonusActive: boolean;
};

export function BillingSection() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [referral, setReferral] = useState<ReferralStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/billing/status");
      if (!res.ok) return null;
      const nextStatus = (await res.json()) as BillingStatus;
      setStatus(nextStatus);
      return nextStatus;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/referrals")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.referralLink) {
          setReferral({
            referralLink: data.referralLink as string,
            referralCount: Number(data.referralCount) || 0,
            required: Number(data.required) || 3,
            bonusActive: Boolean(data.bonusActive)
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const checkoutCompleted = new URLSearchParams(window.location.search).get("billing") === "success";

    async function refresh() {
      const attempts = checkoutCompleted ? 5 : 1;
      for (let attempt = 0; attempt < attempts && !cancelled; attempt++) {
        const nextStatus = await load();
        if (nextStatus?.tier === "pro") {
          if (checkoutCompleted) setMessage("Welcome to Pro! Your limits are updated.");
          return;
        }
        if (attempt < attempts - 1) await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }
      if (checkoutCompleted && !cancelled) {
        setMessage("Payment completed. Pro access is still being finalized; refresh this page in a moment.");
      }
    }

    void refresh();
    return () => { cancelled = true; };
  }, []);

  async function checkout() {
    setActionLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload.url) {
        window.location.href = payload.url;
        return;
      }
      setMessage(payload.error || "Could not start checkout.");
    } catch {
      setMessage("Could not start checkout.");
    } finally {
      setActionLoading(false);
    }
  }

  async function portal() {
    setActionLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload.url) {
        window.location.href = payload.url;
        return;
      }
      setMessage(payload.error || "Could not open billing portal.");
    } catch {
      setMessage("Could not open billing portal.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <section className="panel p-6">
        <span className="status-pill">Loading plan…</span>
      </section>
    );
  }

  if (!status) {
    return (
      <section className="panel p-6">
        <p className="text-sm font-bold text-[var(--muted-strong)]">Could not load billing status.</p>
      </section>
    );
  }

  const isPro = status.tier === "pro";

  return (
    <section className="panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold tracking-[-0.01em]">Plan & billing</h2>
          <p className="mt-2 text-sm text-[var(--muted-strong)]">
            You are on <strong>{status.planName}</strong>
            {isPro && status.currentPeriodEnd
              ? ` · renews ${new Date(status.currentPeriodEnd).toLocaleDateString()}`
              : ""}
          </p>
        </div>
        <span className={`status-pill ${isPro ? "border-[var(--border-strong)] bg-[var(--surface-strong)]" : ""}`}>
          {isPro ? <Crown size={14} /> : null}
          {status.planName}
        </span>
      </div>

      <p className="mt-4 text-xs text-[var(--muted)]">File uploads up to {status.limits.maxFileMb} MB on your plan.</p>

      <div className="mt-6 flex flex-wrap gap-3">
        {isPro ? (
          <button type="button" className="btn-secondary" onClick={portal} disabled={actionLoading || !status.stripeConfigured}>
            <CreditCard size={18} />
            {actionLoading ? "Opening…" : "Manage subscription"}
          </button>
        ) : status.stripeConfigured ? (
          <button type="button" className="btn-primary" onClick={checkout} disabled={actionLoading}>
            <Crown size={18} />
            {actionLoading ? "Redirecting…" : `Upgrade to Pro, $${PLANS.pro.priceMonthly}/mo`}
          </button>
        ) : (
          <Link href="/pricing" className="btn-primary">
            <Crown size={18} />
            View Pro
          </Link>
        )}
        <Link href="/pricing" className="btn-secondary">
          Compare plans
        </Link>
      </div>

      {!status.stripeConfigured && !isPro ? (
        <p className="mt-4 text-sm text-[var(--muted-strong)]">
          Pro checkout is live but not configured in this environment yet.
        </p>
      ) : null}

      {message ? <p className="mt-4 text-sm font-bold text-[var(--muted-strong)]">{message}</p> : null}

      {!isPro ? (
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
          <h3 className="text-sm font-extrabold tracking-[-0.01em] text-[var(--text)]">
            Earn 30 Days of Free Pro Access
          </h3>
          <p className="mt-1 text-xs text-[var(--muted-strong)] leading-relaxed">
            Invite 3 friends to create an account on Selrano. When 3 friends sign up, your account automatically unlocks 30 days of full Pro limits.
          </p>
          {referral ? (
            <>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={referral.referralLink}
                  className="input-premium h-9 text-xs px-3 py-0 flex-1 font-mono select-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(referral.referralLink);
                    setMessage("Referral link copied to clipboard!");
                  }}
                  className="btn-secondary h-9 px-4 text-xs shrink-0"
                >
                  Copy link
                </button>
              </div>
              {!referral.bonusActive ? (
                <p className="mt-3 text-xs text-[var(--muted)]">
                  {Math.max(referral.required - referral.referralCount, 0)} more referral
                  {Math.max(referral.required - referral.referralCount, 0) === 1 ? "" : "s"} to unlock your free month.
                </p>
              ) : (
                <p className="mt-3 text-xs text-[var(--low)]">Pro referral bonus is active.</p>
              )}
            </>
          ) : (
            <p className="mt-3 text-xs text-[var(--muted)]">Loading your referral link…</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
