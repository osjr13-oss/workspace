import { expect, test, type Page } from "@playwright/test";
import { resetMocks, signIn, tableRows } from "./support/session";
import { computeTargets, type TargetInputs } from "../lib/targets";
import { daysToGoal, weeklyRate, weightTrend } from "../lib/trend";
import { localDate, addDays } from "../lib/dates";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const SUPABASE = "http://localhost:54321";

async function seed(table: string, rows: Array<Record<string, unknown>>) {
  await fetch(`${SUPABASE}/__seed`, { method: "POST", body: JSON.stringify({ table, rows }) });
}

const base: TargetInputs = { age: 36, sex: "male", heightCm: 180, weightKg: 90, activity: "light", goal: "lose", weeklyRateKg: 0.5, proteinPerKg: 1.6, flags: [] };

test.describe("targets and trend math", () => {
  test("a typical loss target uses Mifflin-St Jeor and the requested pace", () => {
    const targets = computeTargets(base);
    expect(targets.bmr).toBe(1850);
    expect(targets.tdee).toBe(2544);
    expect(targets.calories).toBe(1990);
    expect(targets.weeklyChangeKg).toBeCloseTo(-0.5, 1);
    expect(targets.proteinG + targets.carbsG + targets.fatG).toBeGreaterThan(0);
    expect(targets.notes).toEqual([]);
  });

  test("pace, deficit and the calorie floor are capped", () => {
    const fast = computeTargets({ ...base, weeklyRateKg: 1 });
    expect(fast.weeklyChangeKg).toBeGreaterThanOrEqual(-0.9);
    const small = computeTargets({ ...base, sex: "female", age: 60, heightCm: 152, weightKg: 62, activity: "sedentary", weeklyRateKg: 1 });
    expect(small.calories).toBeGreaterThanOrEqual(1200);
    expect(small.notes.join(" ")).toMatch(/below 1200|limited/);
    const manual = computeTargets({ ...base, manualCalories: 900 });
    expect(manual.calories).toBe(1500);
  });

  test("minors, pregnancy and a low BMI never get a deficit", () => {
    expect(computeTargets({ ...base, age: 16 }).goal).toBe("maintain");
    expect(computeTargets({ ...base, age: 16 }).calories).toBe(Math.round(computeTargets({ ...base, age: 16 }).tdee / 10) * 10);
    expect(computeTargets({ ...base, sex: "female", flags: ["pregnant"] }).goal).toBe("maintain");
    expect(computeTargets({ ...base, weightKg: 58 }).goal).toBe("maintain");
    const minorManual = computeTargets({ ...base, age: 15, manualCalories: 1600 });
    expect(minorManual.calories).toBeGreaterThan(2000);
  });

  test("the trend smooths daily swings and reports a weekly pace", () => {
    const entries = Array.from({ length: 28 }, (_, day) => ({ local_date: addDays("2026-09-01", day), weight_kg: 90 - day * 0.07 + (day % 2 ? 0.8 : -0.8) }));
    const points = weightTrend(entries, "2026-09-28");
    expect(points).toHaveLength(28);
    const swing = Math.max(...points.slice(10).map((p, i, all) => (i ? Math.abs(p.trend - all[i - 1].trend) : 0)));
    expect(swing).toBeLessThan(0.3);
    const rate = weeklyRate(points);
    expect(rate).not.toBeNull();
    expect(rate!).toBeLessThan(0);
    expect(daysToGoal(points.at(-1)!.trend, 80, rate)).toBeGreaterThan(0);
    expect(daysToGoal(points.at(-1)!.trend, 95, rate)).toBeNull();
  });
});

test.describe("health logging", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "Requires offline fixtures");
  test.beforeEach(async ({ context }) => {
    await resetMocks();
    await signIn(context);
  });

  async function onboarded(page: Page) {
    await seed("health_profiles", [{ user_id: USER_ID, birth_date: "1990-05-01", sex_for_calc: "male", height_cm: 180, activity_level: "light", goal: "lose", goal_weight_kg: 80, weekly_rate_kg: 0.5, units: "metric", timezone: "UTC", target_mode: "auto", manual_calories: null, protein_g_per_kg: 1.6, caution_flags: [], coach_mode: "standard", onboarded_at: "2026-10-01T00:00:00Z" }]);
    await seed("daily_targets", [{ user_id: USER_ID, effective_date: "2026-01-01", calories: 2000, protein_g: 140, carbs_g: 210, fat_g: 60, method: "mifflin", tdee_estimate: 2550, inputs: {} }]);
    await page.goto("/today");
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  }

  test("a new account is sent through onboarding and gets a safe target", async ({ page }) => {
    await page.goto("/today");
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByRole("button", { name: "kg, cm" }).click();
    await page.getByLabel("Date of birth").fill("1990-05-01");
    await page.getByRole("button", { name: "Male", exact: true }).click();
    await page.getByLabel("Height (cm)").fill("180");
    await page.getByLabel("Current weight (kg)").fill("90");
    await page.getByRole("button", { name: "0.5 kg a week" }).click();
    await expect(page.getByLabel("Your daily target")).toContainText("1,990");
    await page.getByRole("button", { name: "Start logging" }).click();
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByLabel("Day summary")).toContainText("1,990");
    const [profile] = await tableRows("health_profiles");
    expect(profile).toMatchObject({ sex_for_calc: "male", units: "metric", goal: "lose" });
    expect(profile.onboarded_at).toBeTruthy();
    expect((await tableRows("weight_entries"))[0].weight_kg).toBe(90);
    expect((await tableRows("daily_targets"))[0].calories).toBe(1990);
  });

  test("onboarding refuses an unsafe goal weight and under-13s", async ({ page }) => {
    await page.goto("/onboarding");
    await page.getByRole("button", { name: "kg, cm" }).click();
    await page.getByLabel("Date of birth").fill("1990-05-01");
    await page.getByLabel("Height (cm)").fill("180");
    await page.getByLabel("Current weight (kg)").fill("70");
    await page.getByLabel("Goal weight (kg, optional)").fill("50");
    await page.getByRole("button", { name: "Start logging" }).click();
    await expect(page.getByText(/below a healthy weight/)).toBeVisible();
    await page.getByLabel("Goal weight (kg, optional)").fill("");
    await page.getByLabel("Date of birth").fill(addDays(localDate("UTC"), -365 * 10));
    await page.getByRole("button", { name: "Start logging" }).click();
    await expect(page.getByText(/13 and older/)).toBeVisible();
    expect(await tableRows("health_profiles")).toHaveLength(0);
  });

  test("search, pick a portion and log it; recents relog in one tap", async ({ page }) => {
    await onboarded(page);
    await page.getByRole("button", { name: "Add to lunch" }).click();
    await page.getByLabel("Search foods").fill("banana");
    // Plain foods come before branded products.
    await expect(page.locator(".food-row").first()).toContainText("Bananas, raw");
    await page.locator(".food-row").first().click();
    await expect(page.getByLabel("Unit")).toHaveValue("0");
    await page.getByRole("button", { name: "Add 105 kcal" }).click();
    await expect(page.getByRole("dialog").getByRole("status")).toContainText("Added Bananas, raw to lunch");
    await page.getByRole("button", { name: "Close" }).last().click();
    await expect(page.getByLabel("Lunch", { exact: true })).toContainText("Bananas, raw");
    await expect(page.getByLabel("Day summary")).toContainText("105");

    let rows = await tableRows("food_entries");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ meal: "lunch", source: "usda", kcal: 105, grams: 118, unit: "1 medium" });
    expect(rows[0].client_id).toBeTruthy();
    expect((await tableRows("foods")).map((food) => food.source_id)).toContain("1105314");

    await page.getByRole("button", { name: "Add to lunch" }).click();
    await expect(page.getByRole("button", { name: "Recent" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Add Bananas, raw" }).click();
    await expect(page.getByRole("dialog").getByRole("status")).toContainText("Added");
    rows = await tableRows("food_entries");
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.client_id)).size).toBe(2);
  });

  test("a typed barcode finds the product; products without nutrition say so", async ({ page }) => {
    await onboarded(page);
    await page.getByRole("button", { name: "Add food" }).click();
    await page.getByRole("button", { name: "Scan" }).click();
    await page.getByLabel("Barcode number").fill("0000000000017");
    await page.getByRole("button", { name: "Look up" }).click();
    await expect(page.getByText(/no nutrition information/)).toBeVisible();
    await page.getByLabel("Barcode number").fill("3017620422003");
    await page.getByRole("button", { name: "Look up" }).click();
    await expect(page.getByRole("heading", { name: "Nutella" })).toBeVisible();
    await page.getByRole("button", { name: "Add 81 kcal" }).click();
    await expect(page.getByRole("dialog").getByRole("status")).toContainText("Added Nutella");
    expect((await tableRows("food_entries"))[0]).toMatchObject({ source: "off", brand: "Ferrero", grams: 15 });
  });

  test("manual entry, saving a meal as a favorite, and removing an item", async ({ page }) => {
    await onboarded(page);
    await page.getByRole("button", { name: "Add to dinner" }).click();
    await page.getByRole("button", { name: "By hand" }).click();
    await page.getByLabel("Food name").fill("Homemade soup");
    await page.getByLabel("Calories").fill("320");
    await page.getByLabel("Protein g").fill("18");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("status")).toContainText("Added Homemade soup to dinner");
    await page.getByRole("button", { name: "Close" }).last().click();

    await page.getByRole("button", { name: "Save dinner as a favorite" }).click();
    await expect(page.getByText('Saved "Homemade soup"')).toBeVisible();
    expect((await tableRows("saved_meals"))[0].items).toHaveLength(1);

    await page.getByRole("button", { name: "Add to snacks" }).click();
    await page.getByRole("button", { name: "Saved" }).click();
    await page.getByRole("button", { name: "Add Homemade soup" }).click();
    await expect(page.getByRole("dialog").getByRole("status")).toContainText("Added Homemade soup to snacks");
    await page.getByRole("button", { name: "Close" }).last().click();
    expect(await tableRows("food_entries")).toHaveLength(2);

    await page.getByLabel("Snacks", { exact: true }).getByRole("button", { name: "Remove Homemade soup" }).click();
    await expect(page.getByLabel("Snacks", { exact: true })).not.toContainText("Homemade soup");
    await expect.poll(async () => (await tableRows("food_entries")).length).toBe(1);
  });

  test("logging weight saves it once and refreshes an automatic target", async ({ page }) => {
    await onboarded(page);
    await page.getByLabel("Weight in kg").fill("88.4");
    await page.getByRole("button", { name: "Log", exact: true }).click();
    await expect(page.getByLabel("Weight", { exact: true })).toContainText("88.4 kg");
    expect((await tableRows("weight_entries"))[0]).toMatchObject({ weight_kg: 88.4, source: "manual" });
    const targets = await tableRows("daily_targets");
    expect(targets.map((row) => row.effective_date)).toContain(localDate("UTC"));
  });

  test("progress shows the smoothed trend, pace and calorie history", async ({ page }) => {
    await onboarded(page);
    const today = localDate("UTC");
    await seed("weight_entries", Array.from({ length: 21 }, (_, i) => ({ user_id: USER_ID, local_date: addDays(today, i - 20), measured_at: `${addDays(today, i - 20)}T07:00:00Z`, weight_kg: 90 - i * 0.1, source: "manual" })));
    await seed("food_entries", [{ user_id: USER_ID, local_date: today, logged_at: new Date().toISOString(), meal: "lunch", name: "Salad", quantity: 1, unit: "serving", kcal: 450, protein_g: 20, carbs_g: 30, fat_g: 25, source: "manual" }]);
    await page.goto("/progress");
    await expect(page.getByLabel("Summary", { exact: true })).toContainText("kg");
    await expect(page.getByLabel("Summary", { exact: true })).toContainText("Weekly pace");
    await expect(page.getByRole("img", { name: /Weight trend from/ })).toBeVisible();
    await expect(page.getByRole("img", { name: /Calories on 1 logged days/ })).toBeVisible();
    await expect(page.getByLabel("Weigh-ins", { exact: true }).locator("li")).toHaveCount(20);
  });
});
