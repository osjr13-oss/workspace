"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { localDate } from "@/lib/dates";
import type { DailyTarget, HealthProfile } from "@/lib/health-profile";

type HealthState = {
  loaded: boolean;
  error: string;
  profile: HealthProfile | null;
  target: DailyTarget | null;
  /** Today in the user's own timezone. */
  today: string;
  refresh: () => Promise<void>;
  setTarget: (target: DailyTarget | null) => void;
};

const HealthContext = createContext<HealthState | null>(null);

/** The signed-in user's health profile and current target, shared by every page. */
export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [target, setTarget] = useState<DailyTarget | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/health/profile", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not load your profile.");
      setProfile(payload.profile || null);
      setTarget(payload.target || null);
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not load your profile.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const timezone = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return (
    <HealthContext.Provider value={{ loaded, error, profile, target, today: localDate(timezone), refresh, setTarget }}>
      {children}
    </HealthContext.Provider>
  );
}

export function useHealth() {
  const value = useContext(HealthContext);
  if (!value) throw new Error("useHealth must be used inside HealthProvider");
  return value;
}

/** Pages that need a profile send people who have not set one up to onboarding. */
export function useRequireProfile() {
  const health = useHealth();
  const router = useRouter();
  const ready = health.loaded && !health.error && Boolean(health.profile?.onboarded_at);
  useEffect(() => {
    if (health.loaded && !health.error && !health.profile?.onboarded_at) router.replace("/onboarding");
  }, [health.loaded, health.error, health.profile, router]);
  return { ...health, ready };
}
