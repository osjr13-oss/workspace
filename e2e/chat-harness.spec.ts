import { expect, test, type Page } from "@playwright/test";
import { control, groqRequests, resetMocks, seed, seedConversation, signIn, tableRows } from "./support/session";

const composer = '[aria-label="Chat message"]';
const bubbles = 'article[aria-label="Selrano response"]';
const questions = 'article[aria-label="Your message"]';
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

test.describe("chat harness", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "Chat tests need the local mock servers.");

  test.beforeEach(async ({ page, context }) => {
    await resetMocks();
    await signIn(context);
    await page.goto("/chats");
  });

  test("editing a question keeps the old version, and the arrows switch between them", async ({ page }) => {
    await sendAndSettle(page, "Plan a trip to Lisbon");
    await sendAndSettle(page, "Add a day in Sintra");
    await expect(page.locator(questions)).toHaveCount(2);

    // Edit the first question: the second turn stays saved under the old version.
    await page.locator(questions).first().hover();
    await page.getByRole("button", { name: "Edit and resend message" }).first().click();
    await page.getByLabel("Edit message").fill("Plan a trip to Porto");
    await page.getByRole("button", { name: "Save and resend" }).click();
    await settled(page);
    await expect(page.locator(questions)).toHaveCount(1);
    await expect(page.locator(questions).first()).toContainText("Porto");
    await expect(page.getByRole("group", { name: "Message versions" })).toContainText("2 / 2");

    const rows = await tableRows("chat_messages");
    expect(rows.filter((row) => row.role === "user")).toHaveLength(3);
    expect(rows.filter((row) => row.role === "assistant")).toHaveLength(3);

    // Back to version 1: the whole earlier branch comes back, including the follow-up.
    await page.getByRole("button", { name: "Previous message version" }).click();
    await expect(page.locator(questions)).toHaveCount(2);
    await expect(page.locator(questions).first()).toContainText("Lisbon");
    await expect(page.locator(questions).nth(1)).toContainText("Sintra");

    // The choice is remembered.
    await page.reload();
    await expect(page.locator(questions)).toHaveCount(2);
    await expect(page.locator(questions).first()).toContainText("Lisbon");
  });

  test("retrying an answer keeps the earlier answer as another version", async ({ page }) => {
    await control({ reply: "First answer about tea." });
    await sendAndSettle(page, "Tell me about tea");
    await control({ reply: "Second answer about tea." });
    await page.locator(bubbles).first().hover();
    await page.getByRole("button", { name: "Regenerate response" }).click();
    await settled(page);
    await expect(page.locator(bubbles)).toHaveCount(1);
    await expect(page.locator(bubbles).first()).toContainText("Second answer");
    await expect(page.getByRole("group", { name: "Response versions" })).toContainText("2 / 2");
    await page.getByRole("button", { name: "Previous response version" }).click();
    await expect(page.locator(bubbles).first()).toContainText("First answer");
    expect((await tableRows("chat_messages")).filter((row) => row.role === "assistant")).toHaveLength(2);
    // Only one question was asked.
    expect((await tableRows("chat_messages")).filter((row) => row.role === "user")).toHaveLength(1);
  });

  test("a follow-up sees what an earlier answer looked up", async ({ page }) => {
    await control({ toolQueue: [{ name: "search_workspace", args: { query: "space missions" } }] });
    await seed("notes", [{ user_id: USER_ID, project_id: null, title: "Space missions", content: "Artemis II launches in April with four astronauts." }]);
    await sendAndSettle(page, "Find my notes about space missions");
    // The answer shows what it did, and keeps showing it after a reload.
    await expect(page.locator(bubbles).first().locator(".activity-trail")).toContainText("Searching your materials");
    await page.reload();
    await expect(page.locator(bubbles).first().locator(".activity-trail")).toContainText("Searching your materials");
    const saved = (await tableRows("chat_messages")).find((row) => row.role === "assistant");
    expect(saved?.tool_trace?.steps?.[0]?.tool).toBe("search_workspace");

    await sendAndSettle(page, "How many astronauts was that?");
    const answer = (await groqRequests()).filter((r) => r.stream).pop();
    expect(answer?.assistantText).toContain("Found while writing this answer");
  });

  test("when deciding whether to search fails, the question is still answered", async ({ page }) => {
    await control({ researchUnavailable: true, reply: "Photosynthesis turns light into sugar." });
    await sendAndSettle(page, "Explain photosynthesis simply");
    await expect(page.locator(bubbles).first()).toContainText("Photosynthesis turns light into sugar.");
    const answer = (await groqRequests()).filter((r) => r.stream).pop();
    expect(answer?.systemText).toContain("Web search was not available for this turn");
  });

  test("Stop pressed right away in a new chat still saves the stopped reply", async ({ page }) => {
    await control({ reply: "Slow words. ".repeat(80), tokenDelayMs: 60, firstTokenDelayMs: 1500 });
    await send(page, "Tell me a long story");
    await page.getByRole("button", { name: "Stop responding" }).click();
    await settled(page);
    await expect.poll(async () => (await tableRows("chat_messages")).filter((row) => row.role === "assistant").length).toBe(1);
    await page.waitForTimeout(3_000);
    const assistants = (await tableRows("chat_messages")).filter((row) => row.role === "assistant");
    expect(assistants).toHaveLength(1);
    expect(String(assistants[0].content)).not.toContain("Slow words. Slow words. Slow words. Slow words. Slow words. Slow words. Slow words. Slow words. Slow words. Slow words. Slow words. Slow words. Slow words. Slow words. Slow words. Slow words. Slow words. Slow words. Slow words. Slow words.");
  });

  test("an old conversation saved before versions existed still shows and continues", async ({ page }) => {
    await seedConversation(3);
    await page.goto("/chats?thread=11111111-1111-4111-8111-111111111111");
    await expect(page.locator(bubbles)).toHaveCount(3);
    await sendAndSettle(page, "And one more thing");
    await expect(page.locator(bubbles)).toHaveCount(4);
    await page.reload();
    await expect(page.locator(bubbles)).toHaveCount(4);
    await expect(page.locator(questions).last()).toContainText("And one more thing");
  });

  test("Cmd+K finds what was said in an earlier chat", async ({ page }) => {
    await control({ reply: "The quarterly zeppelin budget is four thousand dollars." });
    await sendAndSettle(page, "Remind me about the zeppelin budget");
    await page.keyboard.press("ControlOrMeta+k");
    await page.getByLabel("Search chats, notes and files").fill("zeppelin");
    await expect(page.getByRole("listbox", { name: "Results" }).getByRole("option").first()).toContainText("zeppelin");
    await page.getByLabel("Search chats, notes and files").press("Enter");
    await expect(page).toHaveURL(/\/chats\?thread=/);
  });

  // The offline fakes have no file storage, so this checks the box, not the upload.
  test("a long paste becomes an attachment instead of filling the box", async ({ page }) => {
    const long = `Lease clause ${"x".repeat(20)}. `.repeat(180) + "FINAL_CLAUSE_MARKER";
    await page.locator(composer).focus();
    await page.evaluate((text) => {
      const data = new DataTransfer();
      data.setData("text/plain", text);
      document.querySelector('[aria-label="Chat message"]')?.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    }, long);
    await expect(page.getByRole("list", { name: "Attached files" })).toContainText("Pasted text");
    await expect(page.locator(composer)).toHaveValue("");
  });

  test("temporary chats stay out of the chat list", async ({ page }) => {
    await page.getByRole("button", { name: "Temporary chat" }).click();
    await sendAndSettle(page, "Just between us, what is a good gift idea?");
    const threads = await tableRows("chat_threads");
    expect(threads).toHaveLength(1);
    expect(threads[0].temporary).toBe(true);
    await page.goto("/chats");
    await expect(page.getByRole("link", { name: /gift idea/i })).toHaveCount(0);
  });

  test("formulas render as math, and prices stay plain text", async ({ page }) => {
    await control({ reply: "It costs $5 today and $10 tomorrow. The rise is $$\\frac{10 - 5}{5} = 100\\%$$ overall." });
    await sendAndSettle(page, "How much did it go up?");
    const answer = page.locator(bubbles).first();
    await expect(answer.locator(".katex")).toHaveCount(1);
    await expect(answer).toContainText("It costs $5 today and $10 tomorrow.");
  });
});
