"use client";

import { useEffect } from "react";

/**
 * Retries welcome delivery when an authenticated workspace opens. The server
 * keeps delivery idempotent, so previously welcomed accounts are only read.
 */
export function WelcomeEmailTrigger() {
  useEffect(() => {
    const controller = new AbortController();

    async function deliverWelcomeEmail() {
      try {
        const response = await fetch("/api/email/welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          signal: controller.signal
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          console.error("[welcome-email] Delivery retry failed", payload?.error || response.statusText);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[welcome-email] Delivery retry failed", error);
        }
      }
    }

    void deliverWelcomeEmail();
    return () => controller.abort();
  }, []);

  return null;
}
