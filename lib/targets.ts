/**
 * Daily calorie and macro targets, with safety limits enforced in code.
 *
 * Energy needs use the Mifflin-St Jeor equation times an activity factor. A
 * weight-loss deficit is limited three ways: the weekly pace (at most 1% of
 * body weight, or 0.5% for people not above a healthy BMI), the size of the
 * deficit (at most 1000 kcal or a quarter of needs), and a calorie floor that
 * is never crossed. Some situations never get a deficit at all: under 18,
 * pregnancy or breastfeeding, and an already-low BMI. Each adjustment adds a
 * plain-language note the user sees.
 */

export type Sex = "male" | "female" | "unspecified";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "maintain" | "gain";
export type CautionFlag = "pregnant" | "breastfeeding" | "diabetes_meds" | "ed_history" | "kidney" | "other_condition";

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9
};

export const CALORIE_FLOOR: Record<Sex, number> = { female: 1200, male: 1500, unspecified: 1350 };

/** 7700 kcal is roughly one kilogram of body weight. */
export const KCAL_PER_KG = 7700;

export const MIN_AGE = 13;

export type TargetInputs = {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
  weeklyRateKg: number;
  proteinPerKg: number;
  flags: CautionFlag[];
  manualCalories?: number | null;
};

export type Targets = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  bmr: number;
  tdee: number;
  /** The goal actually applied, which safety rules may change to maintain. */
  goal: Goal;
  /** The weekly pace the calories correspond to, in kg (negative while losing). */
  weeklyChangeKg: number;
  method: "mifflin" | "manual";
  notes: string[];
};

export function bmi(weightKg: number, heightCm: number) {
  const meters = heightCm / 100;
  return weightKg / (meters * meters);
}

export function mifflinBmr(age: number, sex: Sex, heightCm: number, weightKg: number) {
  const offset = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + offset;
}

const round10 = (value: number) => Math.round(value / 10) * 10;
const round5 = (value: number) => Math.round(value / 5) * 5;

export function computeTargets(input: TargetInputs): Targets {
  const notes: string[] = [];
  const bmr = mifflinBmr(input.age, input.sex, input.heightCm, input.weightKg);
  const tdee = bmr * ACTIVITY_FACTORS[input.activity];
  const bodyMassIndex = bmi(input.weightKg, input.heightCm);
  const floor = CALORIE_FLOOR[input.sex];

  let goal = input.goal;
  const noDeficit = (reason: string) => {
    if (goal === "lose") notes.push(reason);
    if (goal !== "gain") goal = "maintain";
  };
  if (input.age < 18) noDeficit("Under 18, targets are set to maintain your weight while you are still growing.");
  if (input.flags.includes("pregnant") || input.flags.includes("breastfeeding")) {
    noDeficit("During pregnancy or breastfeeding, targets are set to maintain. Your clinician can tell you what is right for you.");
  }
  if (goal === "lose" && bodyMassIndex < 18.5) noDeficit("Your weight is already in the lower range, so targets are set to maintain.");
  if (input.flags.includes("diabetes_meds") || input.flags.includes("kidney") || input.flags.includes("other_condition")) {
    notes.push("With a medical condition or medication that affects food or weight, check your plan with your clinician.");
  }

  let calories: number;
  let method: Targets["method"] = "mifflin";
  if (input.manualCalories) {
    method = "manual";
    calories = input.manualCalories;
    if (goal === "maintain" && calories < tdee * 0.95) {
      calories = tdee;
      notes.push("Your own calorie target was raised to maintenance because a deficit is not advised for you right now.");
    }
  } else if (goal === "lose") {
    const maxRate = input.weightKg * (bodyMassIndex < 25 ? 0.005 : 0.01);
    let rate = Math.max(0, input.weeklyRateKg);
    if (rate > maxRate) {
      rate = maxRate;
      notes.push(`Pace limited to about ${(Math.round(maxRate * 10) / 10).toFixed(1)} kg a week, the most that is sustainable for you.`);
    }
    let deficit = (rate * KCAL_PER_KG) / 7;
    const maxDeficit = Math.min(1000, tdee * 0.25);
    if (deficit > maxDeficit) {
      deficit = maxDeficit;
      notes.push("The daily deficit is capped so energy, mood and muscle hold up.");
    }
    calories = tdee - deficit;
  } else if (goal === "gain") {
    const surplus = Math.min((Math.max(0, input.weeklyRateKg) * KCAL_PER_KG) / 7, 500);
    calories = tdee + surplus;
  } else {
    calories = tdee;
  }

  if (calories < floor) {
    calories = floor;
    notes.push(`Calories never go below ${floor} a day, so progress may be a little slower.`);
  }
  calories = Math.min(round10(calories), 6000);

  // Protein scales with weight, but not past the weight at a BMI of 27, which
  // would overstate needs for larger bodies.
  const meters = input.heightCm / 100;
  const proteinBasisKg = Math.min(input.weightKg, 27 * meters * meters);
  let proteinG = round5(proteinBasisKg * input.proteinPerKg);
  proteinG = Math.min(proteinG, round5((calories * 0.4) / 4));
  const fatG = round5((calories * 0.28) / 9);
  const carbsG = Math.max(0, round5((calories - proteinG * 4 - fatG * 9) / 4));

  return {
    calories,
    proteinG,
    carbsG,
    fatG,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    goal,
    weeklyChangeKg: Math.round((((calories - tdee) * 7) / KCAL_PER_KG) * 100) / 100,
    method,
    notes
  };
}
