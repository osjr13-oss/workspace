import { expect, test } from "@playwright/test";
import { control, groqRequests, resetMocks, signIn, tableRows } from "./support/session";

test.describe("OpenAI chat", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "Requires offline providers.");
  test.beforeEach(async ({ context, page }) => {
    await resetMocks();
    await signIn(context);
    await page.goto("/chats");
  });

  test("primary streams, hides thinking, sanitizes punctuation, and persists", async ({ page }) => {
    await control({ gpt: true });
    await page.getByLabel("Chat message").fill("Help me think through this");
    await page.getByLabel("Chat message").press("Enter");
    await expect(page.locator('section[aria-busy="false"]')).toBeVisible({ timeout: 25000 });
    const bubble = page.locator('article[aria-label="Selrano response"]');
    await expect(bubble).toContainText("Let's work through it");
    await expect(bubble).not.toContainText("PRIVATE_REASONING");
    expect((await tableRows("chat_messages")).find((row) => row.role === "assistant")?.content).not.toContain("\u2014");
    expect((await groqRequests()).filter((request) => request.stream)).toHaveLength(0);
    const requests = await (await fetch("http://localhost:54322/__gpt_requests")).json();
    expect(requests[0].authorization).toBe("Bearer test-openai-key");
    // Nothing is kept at OpenAI; reasoning comes back encrypted for tool continuations only.
    expect(requests[0].store).toBe(false);
    expect(requests[0].include).toEqual(["reasoning.encrypted_content"]);
    expect(requests[0].instructions).toContain("Selrano");
    await expect(page.locator("section.chat-page")).toHaveAttribute("data-ai-provider", "openai");
    await page.reload();
    await expect(bubble).toContainText("together.");
  });

  test.fixme("tool results replay encrypted reasoning and return to OpenAI", async ({ page }) => {
    await control({ gpt: true, gptTool: true });
    await page.getByLabel("Chat message").fill("Search my notes for biology");
    await page.getByLabel("Chat message").press("Enter");
    await expect(page.locator('article[aria-label="Selrano response"]')).toContainText("together.", { timeout: 25000 });
    const requests = await (await fetch("http://localhost:54322/__gpt_requests")).json();
    expect(requests).toHaveLength(2);
    expect(requests[1].tool_choice).toBe("none");
    const continuation = requests[1].input;
    expect(continuation).toContainEqual({ type: "reasoning", id: "rs_1", summary: [], encrypted_content: "PRIVATE_REASONING" });
    expect(continuation.at(-1)).toMatchObject({ type: "function_call_output", call_id: "call_1" });
    expect((await groqRequests()).filter((request) => request.stream)).toHaveLength(0);
  });

  test.fixme("unavailable OpenAI falls back to Groq with tools intact", async ({ page }) => {
    await control({ toolNext: true });
    await page.getByLabel("Chat message").fill("Find my notes about biology");
    await page.getByLabel("Chat message").press("Enter");
    await expect(page.locator('article[aria-label="Selrano response"]')).toBeVisible({ timeout: 25000 });
    await expect(page.locator('section[aria-busy="false"]')).toBeVisible({ timeout: 25000 });
    const requests = (await groqRequests()).filter((request) => request.stream);
    expect(requests).toHaveLength(2);
    expect(requests[0].tools).toBe(true);
    await expect(page.locator("section.chat-page")).toHaveAttribute("data-ai-provider", "groq");
    await expect(page.locator("section.chat-page")).toHaveAttribute("data-ai-fallback", "503:provider");
    expect(await (await fetch("http://localhost:54322/__gpt_requests")).json()).toHaveLength(1);
  });

  test("the coach sees the user's profile, target, today's log and weight", async ({ page }) => {
    const seed = (table: string, rows: Array<Record<string, unknown>>) => fetch("http://localhost:54321/__seed", { method: "POST", body: JSON.stringify({ table, rows }) });
    const userId = "00000000-0000-4000-8000-000000000001";
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    await seed("health_profiles", [{ user_id: userId, birth_date: "1990-05-01", sex_for_calc: "female", height_cm: 165, activity_level: "moderate", goal: "lose", goal_weight_kg: 63, weekly_rate_kg: 0.5, units: "metric", timezone: "UTC", target_mode: "auto", caution_flags: [], coach_mode: "gentle", onboarded_at: "2026-10-01T00:00:00Z" }]);
    await seed("daily_targets", [{ user_id: userId, effective_date: "2026-01-01", calories: 1750, protein_g: 110, carbs_g: 190, fat_g: 55, method: "mifflin", tdee_estimate: 2200, inputs: {} }]);
    await seed("food_entries", [{ user_id: userId, local_date: today, logged_at: new Date().toISOString(), meal: "breakfast", name: "Oatmeal with berries", quantity: 1, unit: "serving", kcal: 320, protein_g: 10, carbs_g: 55, fat_g: 6, source: "manual" }]);
    await seed("weight_entries", [{ user_id: userId, local_date: today, measured_at: new Date().toISOString(), weight_kg: 70.4, source: "manual" }]);
    await control({ gpt: true });
    await page.getByLabel("Chat message").fill("How am I doing today?");
    await page.getByLabel("Chat message").press("Enter");
    await expect(page.locator('section[aria-busy="false"]')).toBeVisible({ timeout: 25000 });
    const [request] = await (await fetch("http://localhost:54322/__gpt_requests")).json();
    expect(request.instructions).toContain("Daily target: 1,750 kcal, protein 110 g");
    expect(request.instructions).toContain("Today so far: 320 kcal");
    expect(request.instructions).toContain("Breakfast: Oatmeal with berries");
    expect(request.instructions).toContain("Weight: latest 70.4 kg");
    expect(request.instructions).toContain("Goal: lose weight to 63 kg");
    expect(request.instructions).toContain("Gentle mode is on");
    expect(request.instructions.length).toBeLessThan(9000);
  });

  test("without a profile the coach knows to suggest setting one up", async ({ page }) => {
    await control({ gpt: true });
    await page.getByLabel("Chat message").fill("What should I eat tonight?");
    await page.getByLabel("Chat message").press("Enter");
    await expect(page.locator('section[aria-busy="false"]')).toBeVisible({ timeout: 25000 });
    const [request] = await (await fetch("http://localhost:54322/__gpt_requests")).json();
    expect(request.instructions).toContain("has not set up their health profile yet");
  });

  test("interrupted output is saved without splicing in a Groq answer", async ({ page }) => {
    await control({ gpt: true, gptPartial: true });
    await page.getByLabel("Chat message").fill("Explain something");
    await page.getByLabel("Chat message").press("Enter");
    await expect(page.locator('section[aria-busy="false"]')).toBeVisible({ timeout: 25000 });
    await expect(page.locator('article[aria-label="Selrano response"]')).toContainText("cut short");
    expect((await groqRequests()).filter((request) => request.stream)).toHaveLength(0);
  });
});
