import { expect, test, type Page } from "@playwright/test";
import { control, groqRequests, resetMocks, signIn, tableRows } from "./support/session";

// Memory is recalled by meaning (fake embeddings in e2e/support/mock-servers.mjs
// put food words near each other), shown on answers that used it, and managed
// on the Memory page.

const composer = '[aria-label="Chat message"]';
const bubbles = 'article[aria-label="Selrano response"]';

async function ask(page: Page, text: string) {
  const before = await page.locator(bubbles).count();
  await page.locator(composer).fill(text);
  await page.locator(composer).press("Enter");
  await expect(page.locator(bubbles)).toHaveCount(before + 1, { timeout: 25_000 });
  await expect(page.locator('section[aria-busy="false"]')).toBeVisible({ timeout: 25_000 });
}

async function remember(page: Page, content: string, pinned = false) {
  const response = await page.request.post("/api/memories", { data: { content, pinned } });
  expect(response.status()).toBe(200);
  return ((await response.json()) as { memory: { id: string } }).memory.id;
}

async function lastAnswerPrompt() {
  const answers = (await groqRequests()).filter((r) => r.stream);
  return String(answers[answers.length - 1]?.systemText || "");
}

test.describe("memory", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs the local fake services");

  test.beforeEach(async ({ context }) => {
    await resetMocks();
    await signIn(context);
  });

  test("a memory is recalled by meaning, not by shared words", async ({ page }) => {
    await remember(page, "I'm vegetarian");
    await remember(page, "My dog is called Biscuit");
    const [saved] = (await tableRows("content_memories")).filter((row) => row.content === "I'm vegetarian");
    expect(saved.embedding).toHaveLength(1536);
    expect(saved.source).toBe("manual");

    await page.goto("/chats");
    await ask(page, "What should I cook tonight?");
    const prompt = await lastAnswerPrompt();
    expect(prompt).toContain("I'm vegetarian");
    expect(prompt).not.toContain("Biscuit");

    await ask(page, "Explain how tides work");
    expect(await lastAnswerPrompt()).not.toContain("I'm vegetarian");
  });

  test("a pinned memory is always in mind", async ({ page }) => {
    await remember(page, "I live in Toronto", true);
    await page.goto("/chats");
    await ask(page, "Explain how tides work");
    expect(await lastAnswerPrompt()).toContain("I live in Toronto");
  });

  test("an answer that used a memory shows it, and keeps it after reload", async ({ page }) => {
    const id = await remember(page, "I'm vegetarian");
    await control({ reply: "A lentil curry would suit you tonight. [M1]" });
    await page.goto("/chats");
    await ask(page, "What should I cook tonight?");
    const answer = page.locator(bubbles).last();
    await expect(answer).not.toContainText("[M1]");
    const badge = answer.getByRole("link", { name: "From memory: I'm vegetarian" });
    await expect(badge).toBeVisible({ timeout: 15_000 });
    await expect(badge).toHaveAttribute("href", `/memory#${id}`);

    const saved = (await tableRows("chat_messages")).find((m) => m.role === "assistant");
    expect(saved?.citations).toEqual([expect.objectContaining({ kind: "memory", marker: "M1", memoryId: id })]);

    await page.reload();
    await expect(page.locator(bubbles).last().getByRole("link", { name: "From memory: I'm vegetarian" })).toBeVisible();
  });

  test("a correction in chat updates or forgets what Selrano remembers", async ({ page }) => {
    const vegetarian = await remember(page, "I'm vegetarian");
    const dog = await remember(page, "My dog is called Biscuit");
    await page.goto("/chats");
    // The fake model's background memory update returns these changes.
    await control({ memoryChanges: { add: [], update: [], remove: [vegetarian] } });
    await ask(page, "Actually I eat meat again, so forget that I'm vegetarian");
    await expect.poll(async () => (await tableRows("content_memories")).map((row) => row.id), { timeout: 15_000 }).toEqual([dog]);

    await control({ memoryChanges: { add: ["The user eats meat"], update: [{ id: dog, content: "The user's dog is called Pepper" }], remove: [] } });
    await ask(page, "My dog is actually called Pepper now, I renamed him");
    await expect
      .poll(async () => (await tableRows("content_memories")).find((row) => row.id === dog)?.content, { timeout: 15_000 })
      .toBe("The user's dog is called Pepper");
    const learned = (await tableRows("content_memories")).find((row) => row.content === "The user eats meat");
    expect(learned?.source).toBe("chat");
    expect(learned?.embedding).toHaveLength(1536);
  });

  test("asking Selrano to remember something saves it at once, and only when asked", async ({ page }) => {
    await page.goto("/chats");
    await control({ toolQueue: [{ name: "remember", args: { fact: "Check the connected bank directly for money questions." } }] });
    await ask(page, "What is a good savings rate?");
    expect(await tableRows("content_memories")).toHaveLength(0);

    await control({ toolQueue: [{ name: "remember", args: { fact: "Check the connected bank directly for money questions." } }] });
    await ask(page, "Remember to check my bank directly next time. I don't want to see that mistake again");
    const [saved] = await tableRows("content_memories");
    expect(saved.content).toBe("Check the connected bank directly for money questions.");
    expect(saved.source).toBe("chat");
    expect(saved.embedding).toHaveLength(1536);
    const answers = (await groqRequests()).filter((r) => r.stream);
    expect(String(answers[answers.length - 1].toolText)).toContain('Saved to memory: "Check the connected bank directly for money questions."');
  });

  test("the Memory page adds, edits, pins and deletes", async ({ page }) => {
    await page.goto("/memory");
    await expect(page.getByRole("heading", { name: "Memory" })).toBeVisible();
    await expect(page.getByText("Nothing remembered yet")).toBeVisible();

    await page.getByLabel("Something to remember").fill("I prefer short answers in the morning");
    await page.getByRole("button", { name: "Remember" }).click();
    await expect(page.getByText("I prefer short answers in the morning")).toBeVisible();
    await expect(page.getByText(/Added by you/)).toBeVisible();

    await page.getByRole("button", { name: "Edit memory" }).click();
    await page.getByLabel("Edit memory").fill("I prefer short answers before noon");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("I prefer short answers before noon")).toBeVisible();
    const [edited] = await tableRows("content_memories");
    expect(edited.content).toBe("I prefer short answers before noon");
    expect(edited.embedding).toHaveLength(1536);

    await page.getByRole("button", { name: "Pin memory" }).click();
    await expect(page.getByRole("region", { name: "Pinned memories" })).toContainText("before noon");

    await page.reload();
    await expect(page.getByRole("region", { name: "Pinned memories" })).toContainText("before noon");
    await page.getByRole("button", { name: "Delete memory" }).click();
    await page.getByRole("dialog", { name: "Forget this memory?" }).getByRole("button", { name: "Forget" }).click();
    await expect(page.getByText("Nothing remembered yet")).toBeVisible();
    expect(await tableRows("content_memories")).toHaveLength(0);
  });

  test("the sidebar links to Memory", async ({ page }) => {
    await page.goto("/chats");
    await page.getByRole("link", { name: "Memory" }).first().click();
    await expect(page).toHaveURL(/\/memory/);
  });
});
