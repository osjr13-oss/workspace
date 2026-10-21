import { expect, test, type Page } from "@playwright/test";
import { control, groqRequests, installRecorder, readSamples, resetMocks, seed, seedConversation, signIn, tableRows } from "./support/session";

const composer = '[aria-label="Chat message"]';
const bubbles = 'article[aria-label="Selrano response"]';
const USER_ID = "00000000-0000-4000-8000-000000000001";

async function send(page: Page, text: string) {
  await page.locator(composer).fill(text);
  await page.locator(composer).press("Enter");
}

async function settled(page: Page) {
  await expect(page.locator('section[aria-busy="false"]')).toBeVisible({ timeout: 25_000 });
}

async function sendAndSettle(page: Page, text: string) {
  const before = await page.locator(bubbles).count();
  await send(page, text);
  await expect(page.locator(bubbles)).toHaveCount(before + 1, { timeout: 25_000 });
  await settled(page);
}

test.describe("chat experience", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "Chat tests need the local mock servers.");

  test.beforeEach(async ({ page, context }) => {
    await resetMocks();
    await signIn(context);
    await page.goto("/chats");
  });

  test("input-method confirmation does not send and cancellation does not stop a reply", async ({ page }) => {
    const input = page.locator(composer);
    await input.fill("Draft in progress");
    for (const options of [{ isComposing: true }, { keyCode: 229 }]) {
      await input.dispatchEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...options });
      await expect(input).toHaveValue("Draft in progress");
      await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeVisible();
    }

    await control({ reply: "Slow words. ".repeat(50), tokenDelayMs: 60 });
    await input.press("Enter");
    await expect(page.locator(bubbles).first()).toContainText("Slow words", { timeout: 15_000 });
    await input.dispatchEvent("keydown", { key: "Escape", isComposing: true, bubbles: true, cancelable: true });
    await expect(page.getByRole("button", { name: "Stop responding" })).toBeVisible();
    // Let the server finish before the next test resets the shared mock data.
    // Ordinary Escape-to-stop is covered separately below.
    await settled(page);
    await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeVisible();
  });

  test("Stop keeps the words already shown and saves exactly those", async ({ page }) => {
    test.setTimeout(90_000);
    await sendAndSettle(page, "warm up");
    const reply = Array.from({ length: 60 }, (_, i) => `Word${i + 1}`).join(" ");
    await control({ reply, tokenDelayMs: 60 });
    await send(page, "Tell me something long");
    await expect(page.locator(bubbles).nth(1)).toContainText("Word3", { timeout: 15_000 });
    await page.getByRole("button", { name: "Stop responding" }).click();
    await settled(page);
    await expect(page.locator(bubbles).nth(1)).not.toContainText("Word60");
    await expect(page.locator(composer)).toBeEnabled();

    // The server keeps generating in the background; it must not save the full reply on top.
    await page.waitForTimeout(5_000);
    const assistants = (await tableRows("chat_messages")).filter((row) => row.role === "assistant");
    expect(assistants).toHaveLength(2);
    expect(String(assistants[1].content)).toContain("Word3");
    expect(String(assistants[1].content)).not.toContain("Word60");
    await page.reload();
    await expect(page.locator(bubbles)).toHaveCount(2);
    await expect(page.locator(bubbles).nth(1)).not.toContainText("Word60");
  });

  test("a reply that arrives in big bursts still appears smoothly", async ({ page }) => {
    test.setTimeout(90_000);
    await installRecorder(page);
    await page.goto("/chats");
    await sendAndSettle(page, "warm up");
    const reply = Array.from({ length: 40 }, (_, i) => `Sentence ${i + 1} explains one more idea in plain words.`).join(" ");
    await control({ reply, chunkChars: 300, tokenDelayMs: 300 });
    const since = (await readSamples(page)).length;
    await sendAndSettle(page, "Explain it all");

    const lengths = (await readSamples(page)).slice(since).filter((sample) => sample.assistants === 2).map((sample) => sample.len);
    const growth = lengths.slice(1).map((len, i) => len - lengths[i]).filter((step) => step > 0);
    const biggest = Math.max(...growth);
    // Bursts of 300 characters must be spread over many frames, not painted at once.
    expect(biggest, `largest single-frame jump was ${biggest} characters`).toBeLessThan(80);
    expect(growth.length, "the reply should grow over many frames").toBeGreaterThan(40);
  });

  test("answers think harder than background work", async ({ page }) => {
    await seedConversation(6);
    await page.goto("/chats?thread=11111111-1111-4111-8111-111111111111");
    await expect(page.locator(bubbles)).toHaveCount(6);
    await sendAndSettle(page, "Help me plan a hard week");
    await expect.poll(async () => (await groqRequests()).filter((request) => !request.stream).length, { timeout: 15_000 }).toBeGreaterThan(0);
    const requests = await groqRequests();
    expect(requests.filter((request) => request.stream).map((request) => request.reasoning_effort)).toEqual(["medium"]);
    expect(new Set(requests.filter((request) => !request.stream).map((request) => request.reasoning_effort))).toEqual(new Set(["low"]));
  });

  test("Escape stops a reply too", async ({ page }) => {
    await sendAndSettle(page, "warm up");
    await control({ reply: "Slow words. ".repeat(50), tokenDelayMs: 60 });
    await send(page, "Another long one");
    await expect(page.locator(bubbles).nth(1)).toContainText("Slow words", { timeout: 15_000 });
    await page.locator(composer).press("Escape");
    await settled(page);
    await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeVisible();
  });

  test.fixme("while a tool runs, the page says what Selrano is doing", async ({ page }) => {
    await sendAndSettle(page, "warm up");
    await control({ toolNext: true, firstTokenDelayMs: 1_500 });
    await send(page, "Find my notes about Mars missions");
    await expect(page.locator(".tool-status")).toContainText('Searching your materials for "biology"', { timeout: 15_000 });
    await settled(page);
    await expect(page.locator(".tool-status")).toHaveCount(0);
    await expect(page.locator(bubbles).last()).toContainText("Here is a clear answer");
  });

  test("a new conversation shows in the sidebar and can be renamed, reopened, and deleted", async ({ page }) => {
    await sendAndSettle(page, "Plan my week of revision");
    await expect(page).toHaveURL(/\/chats\?thread=/);
    const sidebar = page.getByRole("complementary", { name: "Navigation" });
    await expect(sidebar.getByRole("link", { name: "Plan my week of revision" })).toBeVisible();

    await page.getByRole("button", { name: "Conversation options" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.getByLabel("Conversation title").fill("Weekly plan");
    await page.getByLabel("Conversation title").press("Enter");
    await expect(sidebar.getByRole("link", { name: "Weekly plan" })).toBeVisible();
    expect((await tableRows("chat_threads"))[0].title).toBe("Weekly plan");

    await sidebar.getByRole("link", { name: "New chat" }).click();
    await expect(page.getByText("What's on your plate?")).toBeVisible();
    await expect(page).toHaveURL(/\/chats$/);

    await sidebar.getByRole("link", { name: "Weekly plan" }).click();
    await expect(page.locator(bubbles)).toHaveCount(1);

    await sidebar.getByRole("button", { name: "Delete Weekly plan" }).click();
    await sidebar.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(sidebar.getByRole("link", { name: "Weekly plan" })).toHaveCount(0);
    await expect(page).toHaveURL(/\/chats$/);
    expect(await tableRows("chat_threads")).toHaveLength(0);
  });

  test("code has a copy button and highlighting, and tables scroll", async ({ page }) => {
    await control({ reply: "Run this:\n\n```python\nprint('hello')\n```\n\n| Day | Topic |\n|---|---|\n| Mon | Cells |\n" });
    await sendAndSettle(page, "Show me some code");
    const answer = page.locator(bubbles).last();
    await expect(answer.getByRole("button", { name: "Copy code" })).toBeVisible();
    await expect(answer.locator(".code-block code.hljs")).toContainText("print");
    await expect(answer.locator(".table-scroll table")).toBeVisible();
  });

  test("scrolling up offers a way back to the latest message", async ({ page }) => {
    await seedConversation(8);
    await page.goto("/chats?thread=11111111-1111-4111-8111-111111111111");
    await expect(page.locator(bubbles)).toHaveCount(8);
    await expect(page.getByRole("button", { name: "Jump to latest" })).toHaveCount(0);
    await page.locator(".chat-page .overflow-y-auto").evaluate((list) => {
      list.scrollTop = 0;
      list.dispatchEvent(new Event("scroll"));
    });
    await page.getByRole("button", { name: "Jump to latest" }).click();
    await expect(page.getByRole("button", { name: "Jump to latest" })).toHaveCount(0);
  });

  test("on a phone, the menu opens the chat list", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedConversation(2);
    await page.goto("/chats");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("link", { name: "Earlier chat" }).click();
    await expect(page.locator(bubbles)).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Close menu" })).toHaveCount(0);
  });
});
