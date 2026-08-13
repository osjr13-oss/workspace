"use client";

import { useState } from "react";
import { Crown } from "lucide-react";
import { formatPlanPrice, PLANS } from "@/lib/plans";

export function ProCheckoutButton({ className = "btn-primary w-full justify-center" }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const priceLabel = formatPlanPrice(PLANS.pro.priceMonthly);

  async function checkout() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/billing/checkout", { method: "POST" });
      const payload = (await response.json()) as { url?: string; error?: string };

      if (response.status === 401) {
        window.location.href = "/signup";
        return;
      }

      if (response.ok && payload.url) {
        window.location.href = payload.url;
        return;
      }

      setMessage(payload.error || "Could not start checkout.");
    } catch {
      setMessage("Could not start checkout.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" className={className} onClick={checkout} disabled={loading}>
        <Crown size={18} />
        {loading ? "Redirecting..." : `Upgrade to Pro, ${priceLabel}/mo`}
      </button>
      {message ? <p className="mt-3 text-sm font-bold text-[var(--critical)]">{message}</p> : null}
    </div>
  );
}
