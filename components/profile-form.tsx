"use client";

import { useMemo, useState } from "react";
import { ageOn } from "@/lib/dates";
import { targetsFor, type HealthProfile, type ProfileInput } from "@/lib/health-profile";
import type { ActivityLevel, CautionFlag, Goal, Sex } from "@/lib/targets";
import { cmToFeetInches, displayWeight, feetInchesToCm, inputToKg, weightUnit, type Units } from "@/lib/units";

const ACTIVITY: Array<{ value: ActivityLevel; label: string; hint: string }> = [
  { value: "sedentary", label: "Mostly sitting", hint: "Desk work, little walking" },
  { value: "light", label: "Lightly active", hint: "On your feet some of the day, or light exercise 1 to 3 times a week" },
  { value: "moderate", label: "Moderately active", hint: "Exercise 3 to 5 times a week" },
  { value: "active", label: "Very active", hint: "Hard exercise most days, or a physical job" },
  { value: "very_active", label: "Athlete level", hint: "Training twice a day or heavy manual work" }
];

const FLAGS: Array<{ value: CautionFlag; label: string }> = [
  { value: "pregnant", label: "I am pregnant" },
  { value: "breastfeeding", label: "I am breastfeeding" },
  { value: "diabetes_meds", label: "I take medicine for diabetes or blood sugar" },
  { value: "kidney", label: "I have kidney disease" },
  { value: "ed_history", label: "I have a history of disordered eating" },
  { value: "other_condition", label: "Another condition affects what I can eat" }
];

/** Weekly pace choices, in kg, shown in the user's own units. */
const PACES = [0.25, 0.5, 0.75, 1];

export type ProfileFormValues = ProfileInput & { current_weight_kg?: number | null };

export function ProfileForm({
  initial,
  currentWeightKg,
  askWeight,
  today,
  submitLabel,
  onSubmit
}: {
  initial: Partial<HealthProfile> | null;
  currentWeightKg: number | null;
  askWeight: boolean;
  today: string;
  submitLabel: string;
  onSubmit: (values: ProfileFormValues) => Promise<string | null>;
}) {
  const [units, setUnits] = useState<Units>(initial?.units || (navigatorPrefersImperial() ? "imperial" : "metric"));
  const [birthDate, setBirthDate] = useState(initial?.birth_date || "");
  const [sex, setSex] = useState<Sex>(initial?.sex_for_calc || "unspecified");
  const startHeight = initial?.height_cm ? Number(initial.height_cm) : null;
  const [heightCm, setHeightCm] = useState(startHeight ? String(Math.round(startHeight)) : "");
  const [feet, setFeet] = useState(startHeight ? String(cmToFeetInches(startHeight).feet) : "");
  const [inches, setInches] = useState(startHeight ? String(cmToFeetInches(startHeight).inches) : "");
  const [weight, setWeight] = useState(currentWeightKg ? String(displayWeight(currentWeightKg, initial?.units || "metric")) : "");
  const [activity, setActivity] = useState<ActivityLevel>(initial?.activity_level || "light");
  const [goal, setGoal] = useState<Goal>(initial?.goal || "lose");
  const [goalWeight, setGoalWeight] = useState(initial?.goal_weight_kg ? String(displayWeight(Number(initial.goal_weight_kg), initial?.units || "metric")) : "");
  const [pace, setPace] = useState(Number(initial?.weekly_rate_kg ?? 0.5));
  const [flags, setFlags] = useState<CautionFlag[]>(initial?.caution_flags || []);
  const [coachMode, setCoachMode] = useState<"standard" | "gentle" | undefined>(initial?.coach_mode);
  const [manual, setManual] = useState(initial?.target_mode === "manual" && initial.manual_calories ? String(initial.manual_calories) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function switchUnits(next: Units) {
    if (next === units) return;
    const kg = Number(weight) ? inputToKg(Number(weight), units) : null;
    const goalKg = Number(goalWeight) ? inputToKg(Number(goalWeight), units) : null;
    setUnits(next);
    if (kg) setWeight(String(displayWeight(kg, next)));
    if (goalKg) setGoalWeight(String(displayWeight(goalKg, next)));
    const cm = resolvedHeight();
    if (cm) {
      setHeightCm(String(Math.round(cm)));
      setFeet(String(cmToFeetInches(cm).feet));
      setInches(String(cmToFeetInches(cm).inches));
    }
  }

  function resolvedHeight() {
    if (units === "metric") return Number(heightCm) || null;
    const total = feetInchesToCm(Number(feet) || 0, Number(inches) || 0);
    return total > 0 ? total : null;
  }

  const values: ProfileFormValues = {
    birth_date: birthDate || null,
    sex_for_calc: sex,
    height_cm: resolvedHeight(),
    activity_level: activity,
    goal,
    goal_weight_kg: goal !== "maintain" && Number(goalWeight) ? Math.round(inputToKg(Number(goalWeight), units) * 100) / 100 : null,
    weekly_rate_kg: goal === "maintain" ? 0 : pace,
    units,
    timezone: initial?.timezone && initial.timezone !== "UTC" ? initial.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    target_mode: manual ? "manual" : "auto",
    manual_calories: manual ? Number(manual) : null,
    protein_g_per_kg: Number(initial?.protein_g_per_kg ?? 1.6),
    caution_flags: flags,
    coach_mode: coachMode ?? (flags.includes("ed_history") ? "gentle" : "standard"),
    current_weight_kg: askWeight && Number(weight) ? Math.round(inputToKg(Number(weight), units) * 100) / 100 : null
  };

  const previewWeight = askWeight ? values.current_weight_kg : currentWeightKg;
  const preview = useMemo(() => {
    if (!values.birth_date || !values.height_cm || !previewWeight) return null;
    if (ageOn(values.birth_date, today) < 13) return null;
    try {
      return targetsFor(values, previewWeight, today);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values), previewWeight, today]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const failure = await onSubmit(values);
    if (failure) setError(failure);
    setSaving(false);
  }

  const unit = weightUnit(units);
  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset className="panel space-y-5 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <legend className="text-lg font-extrabold tracking-[-0.01em]">About you</legend>
          <div className="segmented" role="group" aria-label="Units">
            <button type="button" aria-pressed={units === "metric"} onClick={() => switchUnits("metric")}>kg, cm</button>
            <button type="button" aria-pressed={units === "imperial"} onClick={() => switchUnits("imperial")}>lb, ft</button>
          </div>
        </div>
        <label className="block">
          <span className="field-label">Date of birth</span>
          <input type="date" className="input-premium mt-2 w-full px-5" value={birthDate} max={today} onChange={(event) => setBirthDate(event.target.value)} required />
        </label>
        <div>
          <span className="field-label">Sex for the calorie formula</span>
          <div className="segmented mt-2" role="group" aria-label="Sex for the calorie formula">
            {(["female", "male", "unspecified"] as Sex[]).map((value) => (
              <button key={value} type="button" aria-pressed={sex === value} onClick={() => setSex(value)}>
                {value === "unspecified" ? "Prefer not to say" : value === "female" ? "Female" : "Male"}
              </button>
            ))}
          </div>
          <p className="field-hint">Only used to estimate how much energy your body uses.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {units === "metric" ? (
            <label className="block">
              <span className="field-label">Height (cm)</span>
              <input inputMode="decimal" className="input-premium mt-2 w-full px-5" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} placeholder="170" required />
            </label>
          ) : (
            <div>
              <span className="field-label">Height</span>
              <div className="mt-2 flex gap-2">
                <label className="flex-1">
                  <span className="sr-only">Feet</span>
                  <input inputMode="numeric" aria-label="Height feet" className="input-premium w-full px-5" value={feet} onChange={(event) => setFeet(event.target.value)} placeholder="5 ft" required />
                </label>
                <label className="flex-1">
                  <span className="sr-only">Inches</span>
                  <input inputMode="numeric" aria-label="Height inches" className="input-premium w-full px-5" value={inches} onChange={(event) => setInches(event.target.value)} placeholder="7 in" />
                </label>
              </div>
            </div>
          )}
          {askWeight ? (
            <label className="block">
              <span className="field-label">Current weight ({unit})</span>
              <input inputMode="decimal" className="input-premium mt-2 w-full px-5" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder={units === "metric" ? "80" : "175"} required />
            </label>
          ) : null}
        </div>
        <div>
          <span className="field-label">How active are you?</span>
          <div className="mt-2 grid gap-2">
            {ACTIVITY.map((option) => (
              <label key={option.value} className={`choice-row ${activity === option.value ? "choice-row-active" : ""}`}>
                <input type="radio" name="activity" className="sr-only" checked={activity === option.value} onChange={() => setActivity(option.value)} />
                <span className="font-bold">{option.label}</span>
                <span className="text-[13px] text-[var(--muted)]">{option.hint}</span>
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="panel space-y-5 p-5 sm:p-6">
        <legend className="text-lg font-extrabold tracking-[-0.01em]">Your goal</legend>
        <div className="segmented" role="group" aria-label="Goal">
          {(["lose", "maintain", "gain"] as Goal[]).map((value) => (
            <button key={value} type="button" aria-pressed={goal === value} onClick={() => setGoal(value)}>
              {value === "lose" ? "Lose weight" : value === "maintain" ? "Maintain" : "Gain weight"}
            </button>
          ))}
        </div>
        {goal !== "maintain" ? (
          <>
            <label className="block">
              <span className="field-label">Goal weight ({unit}, optional)</span>
              <input inputMode="decimal" className="input-premium mt-2 w-full px-5" value={goalWeight} onChange={(event) => setGoalWeight(event.target.value)} />
            </label>
            <div>
              <span className="field-label">Pace</span>
              <div className="segmented mt-2" role="group" aria-label="Pace">
                {PACES.map((value) => (
                  <button key={value} type="button" aria-pressed={pace === value} onClick={() => setPace(value)}>
                    {units === "metric" ? `${value} kg` : `${Math.round(value * 2.2046 * 4) / 4} lb`} a week
                  </button>
                ))}
              </div>
              <p className="field-hint">Slower is easier to keep up. Selrano limits the pace to what is safe for you.</p>
            </div>
          </>
        ) : null}
        <details className="text-sm">
          <summary className="cursor-pointer font-bold text-[var(--muted-strong)]">Set my own calorie target</summary>
          <label className="mt-3 block">
            <span className="field-label">Calories per day (leave empty for automatic)</span>
            <input inputMode="numeric" className="input-premium mt-2 w-full px-5" value={manual} onChange={(event) => setManual(event.target.value.replace(/\D/g, ""))} />
          </label>
        </details>
      </fieldset>

      <fieldset className="panel space-y-3 p-5 sm:p-6">
        <legend className="text-lg font-extrabold tracking-[-0.01em]">Anything we should know?</legend>
        <p className="text-sm text-[var(--muted-strong)]">Optional. This keeps your targets and coaching safe for you.</p>
        {FLAGS.map((option) => (
          <label key={option.value} className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={flags.includes(option.value)}
              onChange={(event) => setFlags((current) => (event.target.checked ? [...current, option.value] : current.filter((flag) => flag !== option.value)))}
            />
            {option.label}
          </label>
        ))}
        <label className="flex items-start gap-3 border-t border-[var(--border)] pt-4 text-sm">
          <input type="checkbox" className="mt-1" checked={values.coach_mode === "gentle"} onChange={(event) => setCoachMode(event.target.checked ? "gentle" : "standard")} />
          <span>
            <span className="font-bold">Gentle mode.</span> Your coach focuses on regular meals and how you feel, and never pushes you to eat less.
          </span>
        </label>
      </fieldset>

      {preview ? (
        <section className="panel p-5 sm:p-6" aria-label="Your daily target">
          <p className="field-label">Your daily target</p>
          <p className="mt-2 text-4xl font-extrabold tracking-[-0.04em]">{preview.calories.toLocaleString()} <span className="text-lg font-bold text-[var(--muted)]">kcal</span></p>
          <p className="mt-1 text-sm text-[var(--muted-strong)]">
            Protein {preview.proteinG} g, carbs {preview.carbsG} g, fat {preview.fatG} g. You use about {preview.tdee.toLocaleString()} kcal a day.
          </p>
          {preview.notes.map((note) => (
            <p key={note} className="mt-2 text-sm text-[var(--muted-strong)]">{note}</p>
          ))}
        </section>
      ) : null}

      {error ? <p className="text-sm font-bold text-[var(--critical)]" role="alert">{error}</p> : null}
      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}

function navigatorPrefersImperial() {
  if (typeof navigator === "undefined") return false;
  return /^en-(US|LR|MM)$/i.test(navigator.language || "");
}
