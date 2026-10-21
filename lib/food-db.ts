import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { removeEmDashes } from "@/lib/text";

/**
 * Public nutrition data. USDA FoodData Central answers searches; Open Food
 * Facts answers barcodes. Results are cached in `foods` (values per 100 g), so
 * a logged food keeps working even when a provider is slow or down.
 *
 * Only food names and barcodes leave Selrano here, never anything about the user.
 */

export type Serving = { label: string; grams: number };

export type FoodResult = {
  id: string;
  source: "usda" | "off";
  name: string;
  brand: string | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  fiber_100g: number | null;
  servings: Serving[];
  barcode: string | null;
};

type FoodRow = Omit<FoodResult, "id"> & { source_id: string };

const TIMEOUT_MS = 3500;

function usdaBase() {
  return (process.env.USDA_BASE_URL?.trim() || "https://api.nal.usda.gov").replace(/\/$/, "");
}

function offBase() {
  return (process.env.OFF_BASE_URL?.trim() || "https://world.openfoodfacts.org").replace(/\/$/, "");
}

const round = (value: number, places = 1) => Math.round(value * 10 ** places) / 10 ** places;
const finite = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : Number.isFinite(Number(value)) && value !== null && value !== "" ? Number(value) : null);

function tidyName(value: string) {
  const text = removeEmDashes(value).replace(/\s+/g, " ").trim();
  // USDA writes generic foods in sentence fragments ("Bread, white, toasted"); keep them, but tame SHOUTING brand names.
  return text === text.toUpperCase() && /[A-Z]{4}/.test(text) ? text.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : text;
}

async function cache(rows: FoodRow[]): Promise<FoodResult[]> {
  if (!rows.length) return [];
  const { data, error } = await createSupabaseAdminClient()
    .from("foods")
    .upsert(rows.map((row) => ({ ...row, fetched_at: new Date().toISOString() })), { onConflict: "source,source_id" })
    .select("id, source, source_id, name, brand, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, servings, barcode");
  if (error) throw error;
  const byKey = new Map((data || []).map((row) => [`${row.source}:${row.source_id}`, row]));
  return rows
    .map((row) => byKey.get(`${row.source}:${row.source_id}`))
    .filter(Boolean)
    .map((row) => ({
      id: row!.id,
      source: row!.source,
      name: row!.name,
      brand: row!.brand,
      kcal_100g: Number(row!.kcal_100g),
      protein_100g: Number(row!.protein_100g),
      carbs_100g: Number(row!.carbs_100g),
      fat_100g: Number(row!.fat_100g),
      fiber_100g: row!.fiber_100g === null ? null : Number(row!.fiber_100g),
      servings: (row!.servings || []) as Serving[],
      barcode: row!.barcode
    }));
}

// USDA ---------------------------------------------------------------------

type UsdaNutrient = { nutrientId?: number; nutrientNumber?: string; unitName?: string; value?: number };
type UsdaFood = {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: UsdaNutrient[];
  foodMeasures?: Array<{ disseminationText?: string; gramWeight?: number }>;
};

const GENERIC_TYPES = ["Foundation", "SR Legacy", "Survey (FNDDS)"];

function nutrient(food: UsdaFood, ids: number[]) {
  for (const id of ids) {
    const found = food.foodNutrients?.find((item) => item.nutrientId === id && typeof item.value === "number");
    if (found) return found.unitName?.toUpperCase() === "KJ" ? (found.value as number) / 4.184 : (found.value as number);
  }
  return null;
}

function usdaRow(food: UsdaFood): FoodRow | null {
  // 1008 is energy in kcal; 2047/2048 are the Atwater energy values newer Foundation foods use instead.
  const kcal = nutrient(food, [1008, 2048, 2047]);
  if (kcal === null || kcal < 0 || kcal > 900) return null;
  const servings: Serving[] = [];
  for (const measure of food.foodMeasures || []) {
    if (measure.disseminationText && measure.gramWeight && measure.gramWeight > 0 && servings.length < 6 && !/quantity not specified/i.test(measure.disseminationText)) {
      servings.push({ label: removeEmDashes(measure.disseminationText), grams: round(measure.gramWeight) });
    }
  }
  if (food.servingSize && /^(g|grm|gram)/i.test(food.servingSizeUnit || "")) {
    servings.unshift({ label: removeEmDashes(food.householdServingFullText || `${round(food.servingSize)} g`), grams: round(food.servingSize) });
  }
  return {
    source: "usda",
    source_id: String(food.fdcId),
    name: tidyName(food.description).slice(0, 200),
    brand: food.brandName || food.brandOwner ? tidyName(food.brandName || food.brandOwner || "").slice(0, 120) : null,
    kcal_100g: round(kcal),
    protein_100g: round(nutrient(food, [1003]) ?? 0),
    carbs_100g: round(nutrient(food, [1005]) ?? 0),
    fat_100g: round(nutrient(food, [1004]) ?? 0),
    fiber_100g: nutrient(food, [1079]) === null ? null : round(nutrient(food, [1079]) as number),
    servings,
    barcode: food.gtinUpc || null
  };
}

export type FoodSearchOutcome = { outcome: "ok"; foods: FoodResult[] } | { outcome: "unavailable" | "timeout" };

export async function searchFoods(query: string): Promise<FoodSearchOutcome> {
  const params = new URLSearchParams({
    api_key: process.env.USDA_FDC_API_KEY?.trim() || "DEMO_KEY",
    query,
    pageSize: "25",
    dataType: [...GENERIC_TYPES, "Branded"].join(",")
  });
  let foods: UsdaFood[];
  try {
    const response = await fetch(`${usdaBase()}/fdc/v1/foods/search?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!response.ok) return { outcome: "unavailable" };
    foods = ((await response.json()) as { foods?: UsdaFood[] }).foods || [];
  } catch (error) {
    return { outcome: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "unavailable" };
  }
  // Plain foods first ("banana"), then branded products.
  const ranked = [...foods].sort((a, b) => Number(!GENERIC_TYPES.includes(a.dataType)) - Number(!GENERIC_TYPES.includes(b.dataType)));
  const rows = ranked.map(usdaRow).filter((row): row is FoodRow => Boolean(row)).slice(0, 12);
  return { outcome: "ok", foods: await cache(rows) };
}

// Open Food Facts ----------------------------------------------------------

export function isBarcode(code: string) {
  return /^\d{8,14}$/.test(code);
}

export type BarcodeOutcome = { outcome: "ok"; food: FoodResult } | { outcome: "not_found" | "no_nutrition" | "unavailable" };

export async function lookupBarcode(code: string): Promise<BarcodeOutcome> {
  const admin = createSupabaseAdminClient();
  const { data: cached } = await admin
    .from("foods")
    .select("id, source, name, brand, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, servings, barcode")
    .eq("barcode", code)
    .limit(1)
    .maybeSingle();
  if (cached) return { outcome: "ok", food: { ...cached, kcal_100g: Number(cached.kcal_100g), protein_100g: Number(cached.protein_100g), carbs_100g: Number(cached.carbs_100g), fat_100g: Number(cached.fat_100g), fiber_100g: cached.fiber_100g === null ? null : Number(cached.fiber_100g), servings: cached.servings || [] } as FoodResult };

  type OffProduct = { product_name?: string; brands?: string; serving_size?: string; serving_quantity?: number | string; nutriments?: Record<string, unknown> };
  let product: OffProduct | undefined;
  try {
    const response = await fetch(`${offBase()}/api/v2/product/${code}?fields=code,product_name,brands,nutriments,serving_size,serving_quantity`, {
      headers: { "User-Agent": "Selrano/1.0 (https://selrano.com)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store"
    });
    if (response.status === 404) return { outcome: "not_found" };
    if (!response.ok) return { outcome: "unavailable" };
    const payload = (await response.json()) as { status?: number; product?: OffProduct };
    if (payload.status !== 1 || !payload.product) return { outcome: "not_found" };
    product = payload.product;
  } catch {
    return { outcome: "unavailable" };
  }

  const n = product.nutriments || {};
  const kcal = finite(n["energy-kcal_100g"]) ?? (finite(n["energy-kj_100g"]) !== null ? (finite(n["energy-kj_100g"]) as number) / 4.184 : null) ?? (finite(n["energy_100g"]) !== null ? (finite(n["energy_100g"]) as number) / 4.184 : null);
  if (kcal === null || kcal < 0 || kcal > 900) return { outcome: "no_nutrition" };
  const servingGrams = finite(product.serving_quantity);
  const [food] = await cache([
    {
      source: "off",
      source_id: code,
      barcode: code,
      name: tidyName(product.product_name || "Unnamed product").slice(0, 200),
      brand: product.brands ? tidyName(product.brands.split(",")[0]).slice(0, 120) : null,
      kcal_100g: round(kcal),
      protein_100g: round(finite(n.proteins_100g) ?? 0),
      carbs_100g: round(finite(n.carbohydrates_100g) ?? 0),
      fat_100g: round(finite(n.fat_100g) ?? 0),
      fiber_100g: finite(n.fiber_100g) === null ? null : round(finite(n.fiber_100g) as number),
      servings: servingGrams && servingGrams > 0 ? [{ label: removeEmDashes(product.serving_size || `${servingGrams} g`).slice(0, 80), grams: round(servingGrams) }] : []
    }
  ]);
  return food ? { outcome: "ok", food } : { outcome: "unavailable" };
}
