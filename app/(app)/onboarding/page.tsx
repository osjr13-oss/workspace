"use client";

import { useRouter } from "next/navigation";
import { useHealth } from "@/components/health-provider";
import { ProfileForm, type ProfileFormValues } from "@/components/profile-form";

export default function OnboardingPage() {
  const router = useRouter();
  const { loaded, profile, today, refresh } = useHealth();

  async function save(values: ProfileFormValues) {
    const response = await fetch("/api/health/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return payload.error || "Could not save. Please try again.";
    await refresh();
    router.replace("/today");
    return null;
  }

  if (!loaded) return <div className="grid min-h-[60vh] place-items-center"><div className="status-pill">Loading</div></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-7 px-4 py-8 sm:px-6 lg:py-12">
      <div>
        <p className="field-label">Welcome to Selrano</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">Let&apos;s set your daily target</h1>
        <p className="mt-3 text-[15px] leading-6 text-[var(--muted-strong)]">
          A few questions, about a minute. You can change any of it later in Settings.
        </p>
      </div>
      <ProfileForm initial={profile} currentWeightKg={null} askWeight today={today} submitLabel="Start logging" onSubmit={save} />
    </div>
  );
}
