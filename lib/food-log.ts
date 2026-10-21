import type { FoodResult, Serving } from "@/lib/food-db";

/** Shared by the browser and server: food log rows and the arithmetic on them. */

export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
export const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];
export const MEAL_LABELS: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };

export type FoodSource = "usda" | "off" | "ai_text" | "ai_photo" | "manual" | "saved";

export type FoodEntry = {
  id: string;
  local_date: string;
  logged_at: string;
  meal: Meal;
  name: string;
  brand: string | null;
  quantity: number;
  unit: string;
  grams: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  source: FoodSource;
  food_id: string | null;
  confidence: "high" | "medium" | "low" | null;
};

/** What a new log row carries before it is saved. */
export type EntryDraft = Omit<FoodEntry, "id" | "local_date" | "logged_at" | "meal" | "confidence"> & { confidence?: FoodEntry["confidence"] };

export type SavedMeal = { id: string; name: string; items: EntryDraft[]; use_count: number; last_used_at: string | null; favorite: boolean };

export type Totals = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };

export function totals(entries: Array<Pick<FoodEntry, "kcal" | "protein_g" | "carbs_g" | "fat_g">>): Totals {
  const sum = entries.reduce(
    (acc, entry) => ({
      kcal: acc.kcal + Number(entry.kcal),
      protein_g: acc.protein_g + Number(entry.protein_g),
      carbs_g: acc.carbs_g + Number(entry.carbs_g),
      fat_g: acc.fat_g + Number(entry.fat_g)
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
  return { kcal: Math.round(sum.kcal), protein_g: Math.round(sum.protein_g), carbs_g: Math.round(sum.carbs_g), fat_g: Math.round(sum.fat_g) };
}

const r1 = (value: number) => Math.round(value * 10) / 10;

/** A database food at a given serving and count, as a log row. */
export function draftFromFood(food: FoodResult, serving: Serving, quantity: number): EntryDraft {
  const grams = serving.grams * quantity;
  const factor = grams / 100;
  return {
    name: food.name,
    brand: food.brand,
    quantity,
    unit: serving.label,
    grams: r1(grams),
    kcal: r1(food.kcal_100g * factor),
    protein_g: r1(food.protein_100g * factor),
    carbs_g: r1(food.carbs_100g * factor),
    fat_g: r1(food.fat_100g * factor),
    fiber_g: food.fiber_100g === null ? null : r1(food.fiber_100g * factor),
    source: food.source,
    food_id: food.id
  };
}

/** The same item at a different amount; nutrition scales in proportion. */
export function rescale(draft: EntryDraft, quantity: number): EntryDraft {
  const factor = draft.quantity > 0 ? quantity / draft.quantity : 1;
  return {
    ...draft,
    quantity,
    grams: draft.grams === null ? null : r1(draft.grams * factor),
    kcal: r1(draft.kcal * factor),
    protein_g: r1(draft.protein_g * factor),
    carbs_g: r1(draft.carbs_g * factor),
    fat_g: r1(draft.fat_g * factor),
    fiber_g: draft.fiber_g === null ? null : r1(draft.fiber_g * factor)
  };
}

/** "150 g", "1 cup (245 g)" or "2 x 1 medium" for a logged amount. */
export function describeAmount(entry: Pick<EntryDraft, "quantity" | "unit">) {
  const quantity = Number(entry.quantity);
  if (entry.unit === "g") return `${quantity} g`;
  if (entry.unit === "serving") return quantity === 1 ? "1 serving" : `${quantity} servings`;
  return quantity === 1 ? entry.unit : `${quantity} x ${entry.unit}`;
}

/** The usual meal for a time of day, in the user's own clock. */
export function mealForHour(hour: number): Meal {
  if (hour >= 4 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 17 && hour < 22) return "dinner";
  return "snack";
}

export function hourIn(timezone: string, at: Date = new Date()) {
  try {
    return Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).format(at));
  } catch {
    return at.getHours();
  }
}

/** The most recent distinct foods, newest first, for one-tap relogging. */
export function recentFoods(entries: FoodEntry[], limit = 12): EntryDraft[] {
  const seen = new Set<string>();
  const recent: EntryDraft[] = [];
  for (const entry of [...entries].sort((a, b) => (b.logged_at || "").localeCompare(a.logged_at || ""))) {
    const key = `${entry.name.toLowerCase()}|${(entry.brand || "").toLowerCase()}|${entry.unit}|${entry.quantity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    recent.push(toDraft(entry));
    if (recent.length >= limit) break;
  }
  return recent;
}

export function toDraft(entry: FoodEntry | EntryDraft): EntryDraft {
  return {
    name: entry.name,
    brand: entry.brand,
    quantity: Number(entry.quantity),
    unit: entry.unit,
    grams: entry.grams === null ? null : Number(entry.grams),
    kcal: Number(entry.kcal),
    protein_g: Number(entry.protein_g),
    carbs_g: Number(entry.carbs_g),
    fat_g: Number(entry.fat_g),
    fiber_g: entry.fiber_g === null ? null : Number(entry.fiber_g),
    source: entry.source,
    food_id: entry.food_id,
    confidence: entry.confidence ?? null
  };
}
