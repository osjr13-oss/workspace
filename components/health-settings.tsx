"use client";

import { useEffect, useState } from "react";
import { useHealth } from "@/components/health-provider";
import { ProfileForm, type ProfileFormValues } from "@/components/profile-form";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/** Edit the health profile; saving recomputes today's target with the same safety limits as onboarding. */
export function HealthSettings() {
  const { loaded, profile, today, refresh } = useHealth();
  const [weightKg, setWeightKg] = useState<number | null | undefined>(undefined);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase
      .from("weight_entries")
      .select("weight_kg")
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setWeightKg(data ? Number(data.weight_kg) : null));
  }, []);

  if (!loaded || weightKg === undefined) return null;
  if (!profile?.onboarded_at) {
    return (
      <section className="panel p-6">
        <h2 className="text-base font-extrabold tracking-[-0.01em]">Health profile</h2>
        <p className="mt-2 text-sm text-[var(--muted-strong)]">Set up your profile to get a daily target.</p>
        <a href="/onboarding" className="btn-primary mt-4">Set up</a>
      </section>
    );
  }

  async function save(values: ProfileFormValues) {
    setSaved("");
    const response = await fetch("/api/health/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, current_weight_kg: null })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return payload.error || "Could not save. Please try again.";
    await refresh();
    setSaved(`Saved. Your target is now ${payload.target?.calories?.toLocaleString() ?? "updated"} kcal a day.`);
    return null;
  }

  return (
    <section aria-label="Health profile" className="space-y-3">
      <h2 className="text-xl font-extrabold tracking-[-0.02em]">Health profile</h2>
      <ProfileForm initial={profile} currentWeightKg={weightKg} askWeight={false} today={today} submitLabel="Save health profile" onSubmit={save} />
      {saved ? <p className="text-sm font-bold text-[var(--muted-strong)]" role="status">{saved}</p> : null}
    </section>
  );
}
