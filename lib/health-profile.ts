import type { SupabaseClient } from "@supabase/supabase-js";
import { ageOn, isLocalDate, isValidTimezone, localDate } from "@/lib/dates";
import { bmi, computeTargets, MIN_AGE, type ActivityLevel, type CautionFlag, type Goal, type Sex, type Targets } from "@/lib/targets";
import type { Units } from "@/lib/units";

export type HealthProfile = {
  user_id: string;
  birth_date: string | null;
  sex_for_calc: Sex;
  height_cm: number | null;
  activity_level: ActivityLevel;
  goal: Goal;
  goal_weight_kg: number | null;
  weekly_rate_kg: number;
  units: Units;
  timezone: string;
  target_mode: "auto" | "manual";
  manual_calories: number | null;
  protein_g_per_kg: number;
  caution_flags: CautionFlag[];
  coach_mode: "standard" | "gentle";
  onboarded_at: string | null;
};

export type DailyTarget = {
  effective_date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  method: "mifflin" | "adaptive" | "manual";
  tdee_estimate: number | null;
  inputs: { notes?: string[]; goal?: Goal; weeklyChangeKg?: number } & Record<string, unknown>;
};

const SEXES: Sex[] = ["male", "female", "unspecified"];
const ACTIVITIES: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "very_active"];
const GOALS: Goal[] = ["lose", "maintain", "gain"];
const FLAGS: CautionFlag[] = ["pregnant", "breastfeeding", "diabetes_meds", "ed_history", "kidney", "other_condition"];

export type ProfileInput = Omit<HealthProfile, "user_id" | "onboarded_at">;

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() ? Number(value) : NaN);

/** Validate a profile from the browser. Returns the clean profile or a message to show. */
export function validateProfile(raw: Record<string, unknown>, today: string): { profile: ProfileInput } | { error: string } {
  const birthDate = raw.birth_date;
  if (!isLocalDate(birthDate)) return { error: "Enter your date of birth." };
  const age = ageOn(birthDate, today);
  if (age < MIN_AGE) return { error: `Selrano is for people ${MIN_AGE} and older.` };
  if (age > 120) return { error: "Check your date of birth." };

  const height = num(raw.height_cm);
  if (!(height >= 100 && height <= 250)) return { error: "Enter a height between 100 and 250 cm (3 ft 4 in to 8 ft 2 in)." };

  const sex = SEXES.includes(raw.sex_for_calc as Sex) ? (raw.sex_for_calc as Sex) : "unspecified";
  const activity = ACTIVITIES.includes(raw.activity_level as ActivityLevel) ? (raw.activity_level as ActivityLevel) : "light";
  const goal = GOALS.includes(raw.goal as Goal) ? (raw.goal as Goal) : "lose";

  const rate = num(raw.weekly_rate_kg);
  const weeklyRate = Number.isFinite(rate) ? Math.min(1, Math.max(0, rate)) : 0.5;

  const goalWeightRaw = raw.goal_weight_kg === null || raw.goal_weight_kg === "" || raw.goal_weight_kg === undefined ? null : num(raw.goal_weight_kg);
  if (goalWeightRaw !== null && !(goalWeightRaw >= 30 && goalWeightRaw <= 300)) return { error: "Enter a goal weight between 30 and 300 kg (66 to 660 lb), or leave it empty." };
  if (goalWeightRaw !== null && goal === "lose" && bmi(goalWeightRaw, height) < 18.5) {
    const lowest = Math.ceil(18.5 * (height / 100) ** 2);
    return { error: `That goal is below a healthy weight for your height. Choose ${lowest} kg (${Math.round(lowest / 0.45359237)} lb) or more.` };
  }

  const timezone = isValidTimezone(raw.timezone) ? raw.timezone : "UTC";
  const units: Units = raw.units === "imperial" ? "imperial" : "metric";
  const targetMode = raw.target_mode === "manual" ? "manual" : "auto";
  const manual = num(raw.manual_calories);
  if (targetMode === "manual" && !(manual >= 1000 && manual <= 6000)) return { error: "Enter your own calorie target between 1000 and 6000, or use the automatic target." };
  const protein = num(raw.protein_g_per_kg);
  const flags = Array.isArray(raw.caution_flags) ? FLAGS.filter((flag) => (raw.caution_flags as unknown[]).includes(flag)) : [];

  return {
    profile: {
      birth_date: birthDate,
      sex_for_calc: sex,
      height_cm: Math.round(height * 10) / 10,
      activity_level: activity,
      goal,
      goal_weight_kg: goalWeightRaw === null ? null : Math.round(goalWeightRaw * 100) / 100,
      weekly_rate_kg: Math.round(weeklyRate * 100) / 100,
      units,
      timezone,
      target_mode: targetMode,
      manual_calories: targetMode === "manual" ? Math.round(manual) : null,
      protein_g_per_kg: protein >= 0.8 && protein <= 2.5 ? Math.round(protein * 10) / 10 : 1.6,
      caution_flags: flags,
      // A history of disordered eating starts in gentle mode; the user can still change it.
      coach_mode: raw.coach_mode === "gentle" || (raw.coach_mode === undefined && flags.includes("ed_history")) ? "gentle" : "standard"
    }
  };
}

export function targetsFor(profile: ProfileInput, weightKg: number, today: string): Targets | null {
  if (!profile.birth_date || !profile.height_cm) return null;
  return computeTargets({
    age: ageOn(profile.birth_date, today),
    sex: profile.sex_for_calc,
    heightCm: Number(profile.height_cm),
    weightKg,
    activity: profile.activity_level,
    goal: profile.goal,
    weeklyRateKg: Number(profile.weekly_rate_kg),
    proteinPerKg: Number(profile.protein_g_per_kg),
    flags: profile.caution_flags || [],
    manualCalories: profile.target_mode === "manual" ? profile.manual_calories : null
  });
}

export async function latestWeightKg(supabase: SupabaseClient, userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("weight_entries")
    .select("weight_kg")
    .eq("user_id", userId)
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? Number(data.weight_kg) : null;
}

/** Store today's target from the profile and latest weight. Returns what was saved. */
export async function saveTargets(supabase: SupabaseClient, userId: string, profile: ProfileInput, weightKg: number) {
  const today = localDate(profile.timezone);
  const targets = targetsFor(profile, weightKg, today);
  if (!targets) return null;
  const row = {
    user_id: userId,
    effective_date: today,
    calories: targets.calories,
    protein_g: targets.proteinG,
    carbs_g: targets.carbsG,
    fat_g: targets.fatG,
    method: targets.method,
    tdee_estimate: targets.tdee,
    inputs: { weightKg, goal: targets.goal, weeklyChangeKg: targets.weeklyChangeKg, bmr: targets.bmr, notes: targets.notes }
  };
  const { error } = await supabase.from("daily_targets").upsert(row, { onConflict: "user_id,effective_date" });
  if (error) throw error;
  return row;
}
