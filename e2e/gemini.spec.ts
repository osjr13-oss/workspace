import { expect, test } from "@playwright/test";
import { control, aiRequests, resetMocks, signIn, tableRows } from "./support/session";
import { completeStructured } from "../lib/ai";
import { transcribeImage } from "../lib/ocr";

test.describe("Gemini transport", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "Requires offline providers");
  test.beforeEach(async ({ context, page }) => {
    await resetMocks(); await signIn(context); await page.goto("/chats");
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_BASE_URL = "http://localhost:54322/gemini";
  });
  test("streams text without thinking and preserves signed tool continuations", async ({ page }) => {
    await control({ toolNext: true, reply: "We can work through this together." });
    await page.getByLabel("Chat message").fill("Search my notes for biology");
    await page.getByLabel("Chat message").press("Enter");
    await expect(page.getByRole("article", { name: "Selrano response" })).toContainText("together.", { timeout: 25000 });
    await expect(page.locator('section[aria-busy="false"]')).toBeVisible();
    await expect(page.getByText("PRIVATE_REASONING")).toHaveCount(0);
    await expect(page.locator("section.chat-page")).toHaveAttribute("data-ai-provider", "gemini");
    const requests = (await aiRequests()).filter((r) => r.stream) as any[];
    expect(requests).toHaveLength(2);
    expect(requests[1].native.toolConfig.functionCallingConfig.mode).toBe("NONE");
    expect(requests[1].native.contents.find((c: any) => c.role === "model").parts).toContainEqual({ functionCall: { name: "search_workspace", args: { query: "biology" } }, thoughtSignature: "test-signature" });
    expect(requests[1].native.contents.at(-1).parts[0].functionResponse.name).toBe("search_workspace");
  });
  test("interrupted stream saves partial output and never switches providers", async ({ page }) => {
    await control({ partial: true, reply: "Visible partial answer", chunkChars: 100 });
    await page.getByLabel("Chat message").fill("Explain something");
    await page.getByLabel("Chat message").press("Enter");
    await expect(page.getByRole("article", { name: "Selrano response" })).toContainText("cut short", { timeout: 25000 });
    expect((await aiRequests()).filter((r) => r.stream)).toHaveLength(1);
  });
  test("structured outputs still undergo application validation", async () => {
    await control({ structuredReply: '{"count":"invalid"}' });
    await expect(completeStructured({ system: "Count", user: "Count", tool: { name: "count", description: "Count", schema: { type: "object" } }, validate: (v: any) => typeof v?.count === "number" ? v : null })).rejects.toThrow("schema validation");
    await control({ structuredReply: '{"count":3}' });
    expect((await completeStructured({ system: "Count", user: "Count", tool: { name: "count", description: "Count", schema: { type: "object" } }, validate: (v: any) => typeof v?.count === "number" ? v : null })).data).toEqual({ count: 3 });
  });
  test("image reading uses Gemini inline image data", async () => {
    expect(await transcribeImage(Buffer.from("fake-image"), "image/png")).toBe("Image transcription.");
    const calls = await aiRequests() as any[];
    expect(calls.at(-1).native.contents[0].parts[1].inlineData.mimeType).toBe("image/png");
  });
});

for (const action of [
  { name: "create_note", args: { title: "My biology notes", content: "Mitosis produces two daughter cells." }, table: "notes", prompt: "Save a note from my biology material" },
  { name: "create_flashcards", args: { deck_name: "Biology", cards: [{ front: "What does mitosis produce?", back: "Two daughter cells." }] }, table: "flashcards", prompt: "Create flashcards from my biology material" }
]) test(`Gemini executes ${action.name} once`, async ({ context, page }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "Requires offline fixtures");
  await resetMocks(); await signIn(context); await page.goto("/chats");
  await control({ toolNext: true, toolName: action.name, toolArgs: action.args, reply: "Saved your material." });
  await page.getByLabel("Chat message").fill(action.prompt);
  await page.getByLabel("Chat message").press("Enter");
  await expect(page.getByRole("article", { name: "Selrano response" })).toContainText("Saved your material.", { timeout: 20000 });
  await expect(page.locator('section[aria-busy="false"]')).toBeVisible();
  expect(await tableRows(action.table)).toHaveLength(1);
});

test("Gemini embeddings use the existing vector dimension and are normalized", async () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "Requires offline fixtures");
  process.env.GEMINI_API_KEY = "test-key";
  process.env.GEMINI_BASE_URL = "http://localhost:54322/gemini";
  const { embedText } = await import("../lib/embeddings");
  const vector = await embedText("Example public text");
  expect(vector).toHaveLength(1536);
  expect(Math.hypot(...vector)).toBeCloseTo(1);
});
