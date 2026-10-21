"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { EntryDraft, FoodEntry, Meal, SavedMeal } from "@/lib/food-log";
import { removeEmDashes } from "@/lib/text";

/**
 * Browser reads and writes for the food log. Row-level security limits every
 * call to the signed-in user's own rows.
 */

async function userId() {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("You are signed out. Sign in again.");
  return { supabase, id };
}

export async function loadEntries(from: string, to: string): Promise<FoodEntry[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("food_entries")
    .select("*")
    .gte("local_date", from)
    .lte("local_date", to)
    .order("logged_at", { ascending: true });
  if (error) throw error;
  return (data || []) as FoodEntry[];
}

export async function loadRecentEntries(limit = 60): Promise<FoodEntry[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("food_entries").select("*").order("logged_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data || []) as FoodEntry[];
}

/** Log items to a day and meal. Each row carries a fresh client id, so a retry never doubles it. */
export async function logEntries(day: string, meal: Meal, drafts: EntryDraft[]): Promise<FoodEntry[]> {
  const { supabase, id } = await userId();
  const rows = drafts.map((draft) => ({
    user_id: id,
    local_date: day,
    meal,
    logged_at: new Date().toISOString(),
    ...draft,
    name: removeEmDashes(draft.name).trim().slice(0, 200) || "Food",
    brand: draft.brand ? removeEmDashes(draft.brand).slice(0, 120) : null,
    confidence: draft.confidence ?? null,
    client_id: crypto.randomUUID()
  }));
  const { data, error } = await supabase.from("food_entries").insert(rows).select("*");
  if (error) throw error;
  return (data || []) as FoodEntry[];
}

export async function deleteEntry(entryId: string) {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("food_entries").delete().eq("id", entryId);
  if (error) throw error;
}

export async function loadSavedMeals(): Promise<SavedMeal[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("saved_meals").select("*").order("last_used_at", { ascending: false, nullsFirst: false }).limit(50);
  if (error) throw error;
  return (data || []) as SavedMeal[];
}

export async function saveMeal(name: string, items: EntryDraft[]) {
  const { supabase, id } = await userId();
  const { data, error } = await supabase
    .from("saved_meals")
    .insert({ user_id: id, name: removeEmDashes(name).trim().slice(0, 120) || "Saved meal", items: items.slice(0, 20), favorite: true })
    .select("*")
    .single();
  if (error) throw error;
  return data as SavedMeal;
}

export async function deleteSavedMeal(mealId: string) {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("saved_meals").delete().eq("id", mealId);
  if (error) throw error;
}

export async function markSavedMealUsed(meal: SavedMeal) {
  const supabase = createSupabaseBrowserClient();
  await supabase.from("saved_meals").update({ use_count: meal.use_count + 1, last_used_at: new Date().toISOString() }).eq("id", meal.id);
}

export async function loadDayComplete(day: string) {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.from("food_days").select("complete").eq("local_date", day).maybeSingle();
  return Boolean(data?.complete);
}

export async function setDayComplete(day: string, complete: boolean) {
  const { supabase, id } = await userId();
  const { error } = await supabase.from("food_days").upsert({ user_id: id, local_date: day, complete }, { onConflict: "user_id,local_date" });
  if (error) throw error;
}

export type WeightEntry = { id: string; local_date: string; measured_at: string; weight_kg: number; note: string | null; source: string };

export async function loadWeights(from: string): Promise<WeightEntry[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("weight_entries").select("id, local_date, measured_at, weight_kg, note, source").gte("local_date", from).order("measured_at", { ascending: true });
  if (error) throw error;
  return ((data || []) as WeightEntry[]).map((row) => ({ ...row, weight_kg: Number(row.weight_kg) }));
}

export async function deleteWeight(entryId: string) {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("weight_entries").delete().eq("id", entryId);
  if (error) throw error;
}
