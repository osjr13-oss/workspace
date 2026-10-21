"use client";

import { useCallback, useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { useHealth } from "@/components/health-provider";
import { formatDay } from "@/lib/dates";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { displayWeight, inputToKg, weightUnit } from "@/lib/units";

/** A one-field weigh-in for the day being viewed. */
export function WeightQuickLog({ day }: { day: string }) {
  const { profile, today, setTarget } = useHealth();
  const units = profile?.units || "metric";
  const [latest, setLatest] = useState<{ weight_kg: number; local_date: string } | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.from("weight_entries").select("weight_kg, local_date").lte("local_date", day).order("measured_at", { ascending: false }).limit(1).maybeSingle();
    setLatest(data ? { weight_kg: Number(data.weight_kg), local_date: data.local_date } : null);
  }, [day]);

  useEffect(() => {
    void load();
    setMessage("");
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const typed = Number(value.replace(",", "."));
    if (!(typed > 0)) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/health/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightKg: inputToKg(typed, units), date: day, clientId: crypto.randomUUID() })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not save that weight.");
      if (payload.target) setTarget(payload.target);
      setValue("");
      setMessage("Saved.");
      await load();
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : "Could not save that weight.");
    } finally {
      setSaving(false);
    }
  }

  const loggedToday = latest?.local_date === day;
  return (
    <section className="panel p-4" aria-label="Weight">
      <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
        <Scale size={18} className="text-[var(--muted)]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold">Weight</p>
          <p className="text-[12px] text-[var(--muted)]">
            {latest
              ? `${loggedToday ? (day === today ? "Today" : formatDay(day)) : `Last: ${formatDay(latest.local_date)}`}, ${displayWeight(latest.weight_kg, units)} ${weightUnit(units)}`
              : "No weigh-ins yet"}
          </p>
        </div>
        <label className="sr-only" htmlFor="weight-input">Weight in {weightUnit(units)}</label>
        <input
          id="weight-input"
          inputMode="decimal"
          className="input-premium w-28 px-4"
          placeholder={weightUnit(units)}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={saving || !value}>{saving ? "Saving" : "Log"}</button>
      </form>
      {message ? <p className="mt-2 text-sm text-[var(--muted-strong)]" role="status">{message}</p> : null}
    </section>
  );
}
