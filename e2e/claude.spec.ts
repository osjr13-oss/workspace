import { expect, test } from "@playwright/test";
import { control, groqRequests, resetMocks, signIn, tableRows } from "./support/session";

test.describe("Claude chat", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "Requires offline providers.");
  test.beforeEach(async ({ context, page }) => {
    await resetMocks();
    await signIn(context);
    await page.goto("/chats");
  });

  test("primary streams, hides thinking, sanitizes punctuation, and persists", async ({ page }) => {
    await control({ claude: true });
    await page.getByLabel("Chat message").fill("Help me think through this");
    await page.getByLabel("Chat message").press("Enter");
    await expect(page.locator('section[aria-busy="false"]')).toBeVisible({ timeout: 25000 });
    const bubble = page.locator('article[aria-label="Selrano response"]');
    await expect(bubble).toContainText("Let's work through it");
    await expect(bubble).not.toContainText("PRIVATE_REASONING");
    expect((await tableRows("chat_messages")).find((row) => row.role === "assistant")?.content).not.toContain("\u2014");
    expect((await groqRequests()).filter((request) => request.stream)).toHaveLength(0);
    await page.reload();
    await expect(bubble).toContainText("together.");
  });

  test("tool results preserve signed thinking and return to Claude", async ({ page }) => {
    await control({ claude: true, claudeTool: true });
    await page.getByLabel("Chat message").fill("Search my notes for biology");
    await page.getByLabel("Chat message").press("Enter");
    await expect(page.locator('article[aria-label="Selrano response"]')).toContainText("together.", { timeout: 25000 });
    const requests = await (await fetch("http://localhost:54322/__claude_requests")).json();
    expect(requests).toHaveLength(2);
    expect(requests[1].tools).toHaveLength(4);
    expect(requests[1].tool_choice).toEqual({ type: "none" });
    const continuation = requests[1].messages;
    expect(continuation.find((message: { role: string }) => message.role === "assistant").content).toContainEqual({ type: "thinking", thinking: "PRIVATE_REASONING", signature: "test-signature" });
    expect(continuation.at(-1).content[0]).toMatchObject({ type: "tool_result", tool_use_id: "toolu_1" });
    expect((await groqRequests()).filter((request) => request.stream)).toHaveLength(0);
  });

  test("unavailable Claude falls back to Groq with tools intact", async ({ page }) => {
    await control({ toolNext: true });
    await page.getByLabel("Chat message").fill("Search the web for news");
    await page.getByLabel("Chat message").press("Enter");
    await expect(page.locator('article[aria-label="Selrano response"]')).toBeVisible({ timeout: 25000 });
    await expect(page.locator('section[aria-busy="false"]')).toBeVisible({ timeout: 25000 });
    const requests = (await groqRequests()).filter((request) => request.stream);
    expect(requests).toHaveLength(2);
    expect(requests[0].tools).toBe(true);
    expect(await (await fetch("http://localhost:54322/__claude_requests")).json()).toHaveLength(1);
  });

  test("interrupted output is saved without splicing in a Groq answer", async ({ page }) => {
    await control({ claude: true, claudePartial: true });
    await page.getByLabel("Chat message").fill("Explain something");
    await page.getByLabel("Chat message").press("Enter");
    await expect(page.locator('section[aria-busy="false"]')).toBeVisible({ timeout: 25000 });
    await expect(page.locator('article[aria-label="Selrano response"]')).toContainText("cut short");
    expect((await groqRequests()).filter((request) => request.stream)).toHaveLength(0);
  });
});
