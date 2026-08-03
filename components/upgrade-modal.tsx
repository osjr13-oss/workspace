"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle2, Zap } from "lucide-react";
import { ProCheckoutButton } from "@/components/pro-checkout-button";
import { PLANS } from "@/lib/plans";
import type { UpgradeReason } from "@/lib/upgrade-reason";

export type { UpgradeReason };

const REASON_TITLES: Record<UpgradeReason, string> = {
  projects: "Project limit reached",
  decks: "Flashcard deck limit reached",
  ai_limit: "Daily AI request limit reached",
  file_size: "File size limit exceeded",
  general: "Unlock the full power of Selrano"
};

const REASON_DESCRIPTIONS: Record<UpgradeReason, string> = {
  projects: "Free tier is limited to 3 projects. Upgrade to Pro for unlimited project workspaces.",
  decks: "Free tier allows up to 5 flashcard decks. Upgrade to Pro for unlimited study decks.",
  ai_limit: "You have reached your 20 daily AI requests. Upgrade to Pro to get 500 requests per day.",
  file_size: "Free tier uploads are capped at 20 MB per file. Upgrade to Pro to upload files up to 100 MB.",
  general: "Upgrade to Pro to eliminate limits, upload larger materials, and get priority AI access."
};

export function UpgradeModal({
  isOpen,
  onClose,
  reason = "general"
}: {
  isOpen: boolean;
  onClose: () => void;
  reason?: UpgradeReason;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog container */}
      <div className="panel relative z-10 w-full max-w-lg overflow-hidden p-6 sm:p-8 shadow-2xl transition-all border border-[var(--border-strong)] bg-[var(--background-elevated)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--text)] text-[var(--background-elevated)]">
            <Zap size={20} />
          </div>
          <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">Selrano Pro</span>
        </div>

        <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.02em] text-[var(--text)]">
          {REASON_TITLES[reason]}
        </h2>

        <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
          {REASON_DESCRIPTIONS[reason]}
        </p>

        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4 space-y-3">
          {[
            "500 AI requests per day (vs 20 on Free)",
            "Unlimited projects & flashcard decks",
            "Upload files up to 100 MB",
            "Priority AI processing & memory retention"
          ].map((benefit) => (
            <div key={benefit} className="flex items-center gap-2.5 text-xs font-extrabold text-[var(--text)]">
              <CheckCircle2 size={16} className="text-[var(--low)] shrink-0" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          <ProCheckoutButton className="btn-primary w-full justify-center py-3 text-base" />
          <p className="text-center text-xs font-bold text-[var(--muted)]">
            ${PLANS.pro.priceMonthly}/month. Cancel anytime with one click.
          </p>
        </div>
      </div>
    </div>
  );
}
