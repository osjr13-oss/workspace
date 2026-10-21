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

  test("interrupted output is saved without splicing in a Groq answer", async ({ page }) => {
    await control({ gpt: true, gptPartial: true });
    await page.getByLabel("Chat message").fill("Explain something");
    await page.getByLabel("Chat message").press("Enter");
    await expect(page.locator('section[aria-busy="false"]')).toBeVisible({ timeout: 25000 });
    await expect(page.locator('article[aria-label="Selrano response"]')).toContainText("cut short");
    expect((await groqRequests()).filter((request) => request.stream)).toHaveLength(0);
  });
});
