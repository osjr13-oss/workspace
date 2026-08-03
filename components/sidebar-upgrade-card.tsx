"use client";

import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { UpgradeModal } from "@/components/upgrade-modal";

type SimpleBillingStatus = {
  tier: "free" | "pro";
  stripeConfigured: boolean;
};

export function SidebarUpgradeCard() {
  const [status, setStatus] = useState<SimpleBillingStatus | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setStatus({ tier: data.tier, stripeConfigured: data.stripeConfigured });
      })
      .catch(() => {});
  }, []);

  if (!status) return null;

  if (status.tier === "pro") {
    return (
      <div className="mt-4 flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3 text-xs font-extrabold text-[var(--text)]">
        <span className="flex items-center gap-2">
          <Crown size={15} className="text-[var(--medium)]" />
          Selrano Pro
        </span>
        <span className="rounded-full bg-[var(--surface-strong)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--muted)]">
          Active
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow-tight)]">
        <div className="flex items-center gap-2 text-xs font-extrabold tracking-[0.05em] uppercase text-[var(--text)]">
          <Crown size={16} />
          Upgrade to Pro
        </div>
        <p className="mt-1.5 text-xs text-[var(--muted-strong)] leading-relaxed">
          Get 500 AI requests/day and unlimited projects.
        </p>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="btn-primary mt-3 h-9 w-full text-xs justify-center py-0"
        >
          Upgrade
        </button>
      </div>

      <UpgradeModal isOpen={modalOpen} onClose={() => setModalOpen(false)} reason="general" />
    </>
  );
}
