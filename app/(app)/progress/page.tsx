"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { CalorieChart, WeightChart } from "@/components/charts";
import { useRequireProfile } from "@/components/health-provider";
import { addDays, formatDay } from "@/lib/dates";
import type { FoodEntry } from "@/lib/food-log";
import { deleteWeight, loadEntries, loadWeights, type WeightEntry } from "@/lib/food-log-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { daysToGoal, weeklyRate, weightTrend } from "@/lib/trend";
import { displayWeight, weightUnit } from "@/lib/units";

const WEIGHT_RANGES = [30, 90, 365] as const;
const CALORIE_RANGES = [7, 30, 90] as const;

export default function ProgressPage() {
  const { ready, profile, today } = useRequireProfile();
  const [weightRange, setWeightRange] = useState<(typeof WEIGHT_RANGES)[number]>(90);
  const [calorieRange, setCalorieRange] = useState<(typeof CALORIE_RANGES)[number]>(30);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [targets, setTargets] = useState<Array<{ effective_date: string; calories: number }>>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      // A month before the visible range lets the trend settle before it is drawn.
      const supabase = createSupabaseBrowserClient();
      const [weightRows, foodRows, targetRows] = await Promise.all([
        loadWeights(addDays(today, -400)),
        loadEntries(addDays(today, -89), today),
        supabase.from("daily_targets").select("effective_date, calories").order("effective_date", { ascending: true })
      ]);
      setWeights(weightRows);
      setEntries(foodRows);
      setTargets((targetRows.data || []) as Array<{ effective_date: string; calories: number }>);
      setError("");
    } catch {
      setError("Could not load your progress. Check your connection and try again.");
    }
  }, [today]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const units = profile?.units || "metric";
  const unit = weightUnit(units);
  const convert = useCallback((kg: number) => displayWeight(kg, units), [units]);

  const trend = useMemo(() => weightTrend(weights, today), [weights, today]);
  const visible = useMemo(() => trend.filter((point) => point.date > addDays(today, -weightRange)), [trend, today, weightRange]);
  const rate = weeklyRate(trend);
  const current = trend.at(-1)?.trend ?? null;
  const monthAgo = trend.find((point) => point.date === addDays(today, -30))?.trend ?? null;
  const goalKg = profile?.goal_weight_kg ? Number(profile.goal_weight_kg) : null;
  const toGoal = current !== null && goalKg ? daysToGoal(current, goalKg, rate) : null;

  const calorieDays = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const entry of entries) byDay.set(entry.local_date, (byDay.get(entry.local_date) || 0) + Number(entry.kcal));
    const days = [];
    for (let i = calorieRange - 1; i >= 0; i -= 1) {
      const date = addDays(today, -i);
      const target = [...targets].reverse().find((row) => row.effective_date <= date)?.calories ?? null;
      days.push({ date, kcal: byDay.get(date) || 0, target });
    }
    return days;
  }, [entries, targets, calorieRange, today]);
  const logged = calorieDays.filter((day) => day.kcal > 0);
  const average = logged.length ? Math.round(logged.reduce((sum, day) => sum + day.kcal, 0) / logged.length) : null;

  if (!ready || !profile) return <div className="grid min-h-[60vh] place-items-center"><div className="status-pill">Loading</div></div>;

  async function remove(entry: WeightEntry) {
    setWeights((rows) => rows.filter((row) => row.id !== entry.id));
    try {
      await deleteWeight(entry.id);
    } catch {
      setError("Could not remove that weigh-in.");
      void load();
    }
  }

  const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pb-24 pt-6 sm:px-6 lg:pt-10">
      <h1 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">Progress</h1>
      {error ? <p className="text-sm font-bold text-[var(--critical)]" role="alert">{error}</p> : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Summary">
        <Stat label="Trend weight" value={current !== null ? `${convert(current).toFixed(1)} ${unit}` : "None yet"} />
        <Stat label="Last 30 days" value={current !== null && monthAgo !== null ? `${signed(convert(current) - convert(monthAgo))} ${unit}` : "Not enough data"} />
        <Stat label="Weekly pace" value={rate !== null ? `${signed(convert(Math.abs(rate)) * Math.sign(rate))} ${unit}` : "Not enough data"} />
        <Stat label="Goal" value={goalKg ? (toGoal ? `About ${formatDay(addDays(today, toGoal), { month: "short", day: "numeric", year: "numeric" })}` : `${convert(goalKg)} ${unit}`) : "Not set"} />
      </section>

      <section className="panel p-4 sm:p-5" aria-label="Weight trend">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-extrabold">Weight</h2>
          <Range options={WEIGHT_RANGES} value={weightRange} onChange={setWeightRange} label={(value) => (value === 365 ? "1 yr" : `${value} d`)} />
        </div>
        <WeightChart points={visible} unitLabel={unit} convert={convert} goal={goalKg} />
        <p className="mt-3 text-[12px] leading-5 text-[var(--muted)]">Daily weight jumps with water and food. The trend line smooths that out, so it is the number to watch.</p>
      </section>

      <section className="panel p-4 sm:p-5" aria-label="Calories">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-extrabold">Calories</h2>
          <Range options={CALORIE_RANGES} value={calorieRange} onChange={setCalorieRange} label={(value) => `${value} d`} />
        </div>
        <CalorieChart days={calorieDays} />
        <p className="mt-3 text-[12px] text-[var(--muted)]">
          {average !== null ? `Average ${average.toLocaleString()} kcal on ${logged.length} logged ${logged.length === 1 ? "day" : "days"}. ` : ""}
          Green lines mark your target.
        </p>
      </section>

      {weights.length ? (
        <section className="panel p-4 sm:p-5" aria-label="Weigh-ins">
          <h2 className="text-base font-extrabold">Weigh-ins</h2>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {[...weights].reverse().slice(0, 20).map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex-1">{formatDay(entry.local_date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                <span className="font-bold tabular-nums">{convert(entry.weight_kg)} {unit}</span>
                <button type="button" className="icon-button opacity-60 hover:opacity-100" aria-label={`Remove weigh-in on ${formatDay(entry.local_date)}`} onClick={() => remove(entry)}>
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className="mt-1.5 text-lg font-extrabold tabular-nums tracking-[-0.01em]">{value}</p>
    </div>
  );
}

function Range<T extends number>({ options, value, onChange, label }: { options: readonly T[]; value: T; onChange: (value: T) => void; label: (value: T) => string }) {
  return (
    <div className="segmented segmented-small" role="group" aria-label="Range">
      {options.map((option) => (
        <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)}>
          {label(option)}
        </button>
      ))}
    </div>
  );
}
