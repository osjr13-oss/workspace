"use client";

import { useState } from "react";
import { UpgradeModal, type UpgradeReason } from "@/components/upgrade-modal";
import { detectUpgradeReason } from "@/lib/upgrade-reason";

export function useUpgradePrompt() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<UpgradeReason>("general");

  function promptUpgrade(nextReason: UpgradeReason = "general") {
    setReason(nextReason);
    setOpen(true);
  }

  function promptFromResponse(
    status: number,
    payload?: { reason?: unknown; code?: unknown; error?: unknown } | null
  ) {
    const detected = detectUpgradeReason(status, payload);
    if (!detected) return false;
    promptUpgrade(detected);
    return true;
  }

  const modal = <UpgradeModal isOpen={open} onClose={() => setOpen(false)} reason={reason} />;

  return { modal, promptUpgrade, promptFromResponse };
}
