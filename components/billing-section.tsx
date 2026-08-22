"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, CreditCard, Crown, Sparkles, Zap } from "lucide-react";
import { formatPlanPrice, PLANS } from "@/lib/plans";

type BillingStatus = {
  tier: "free" | "pro";
  planName: string;
  priceMonthly: number;
  priceKind?: "founding" | "standard";
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  limits: {
    aiRequests?: number;
    aiPeriod?: "day" | "month";
    dailyAiRequests: number;
    maxProjects: number | null;
    maxFileMb: number;
    maxDecks: number | null;
  };
  usage: {
    aiUsed?: number;
    aiToday: number;
    projects: number;
    decks: number;
  };
  stripeConfigured: boolean;
};

export function BillingSection() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
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
    const checkoutCompleted =
      new URLSearchParams(window.location.search).get("billing") === "success";

    async function refresh() {
      const attempts = checkoutCompleted ? 5 : 1;
      for (let attempt = 0; attempt < attempts && !cancelled; attempt++) {
        const nextStatus = await load();
        if (nextStatus?.tier === "pro") {
          if (checkoutCompleted) setMessage("Welcome to Pro! Your limits are updated.");
          return;
        }
        if (attempt < attempts - 1)
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }
      if (checkoutCompleted && !cancelled) {
        setMessage(
          "Payment completed. Pro access is finalizing; refresh this page in a moment."
        );
      }
    }

    void refresh();
    return () => {
      cancelled = true;
    };
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
      setMessage(payload.error || "Could not initiate checkout.");
    } catch {
      setMessage("Could not initiate checkout.");
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
      <section className="panel p-6 bg-white shadow-sm">
        <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
      </section>
    );
  }

  if (!status) {
    return (
      <section className="panel p-6 bg-white shadow-sm">
        <p className="text-xs font-semibold text-[var(--critical)]">
          Could not load billing status.
        </p>
      </section>
    );
  }

  const isPro = status.tier === "pro";
  const proPriceLabel = formatPlanPrice(PLANS.pro.priceMonthly);

  return (
    <section className="panel p-6 bg-white shadow-sm space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[var(--text)]">Plan & Subscription</h2>
            <span className={isPro ? "badge badge-brand" : "badge badge-subtle"}>
              {status.planName}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--muted-strong)]">
            {isPro && status.currentPeriodEnd
              ? `Renews on ${new Date(status.currentPeriodEnd).toLocaleDateString()}`
              : "Free workspace tier with standard thinking and memory"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-slate-50/70 p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[var(--muted)]">File upload limit</span>
          <span className="font-bold text-[var(--text)]">{status.limits.maxFileMb} MB / file</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[var(--muted)]">Durable Memory Bank</span>
          <span className="font-bold text-emerald-600">Active</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[var(--muted)]">Live Web Grounding</span>
          <span className="font-bold text-blue-600">Enabled</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {isPro ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={portal}
            disabled={actionLoading || !status.stripeConfigured}
          >
            <CreditCard size={15} />
            <span>{actionLoading ? "Opening..." : "Manage Billing & Invoices"}</span>
          </button>
        ) : status.stripeConfigured ? (
          <button
            type="button"
            className="btn-primary"
            onClick={checkout}
            disabled={actionLoading}
          >
            <Crown size={15} />
            <span>{actionLoading ? "Redirecting..." : `Upgrade to Pro (${proPriceLabel}/mo)`}</span>
          </button>
        ) : (
          <Link href="/pricing" className="btn-primary">
            <Crown size={15} />
            <span>View Pro Plan</span>
          </Link>
        )}
        <Link href="/pricing" className="btn-secondary">
          Compare Plans
        </Link>
      </div>

      {message && (
        <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
          {message}
        </p>
      )}
    </section>
  );
}
