import { expect, test } from "@playwright/test";
import { control, resetMocks, signIn, tableRows } from "./support/session";
import { assessResearch, groundAnswer, runResearch } from "../lib/research";
import type { Grounding } from "../lib/gemini";

const text = "Applications close on 30 November 2026.";
const fixture = (answer = text): Grounding => ({
  webSearchQueries: ["program deadline"], searchEntryPoint: { renderedContent: '<a href="https://www.google.com/search?q=program">Search Google</a>' },
  groundingChunks: [{ web: { uri: "https://agency.gov/program", title: "Agency program" } }],
  groundingSupports: [{ segment: { startIndex: 0, endIndex: answer.length, text: answer }, groundingChunkIndices: [0] }]
});
const history = [{ role: "user" as const, content: "Research the program deadline" }];
const assessment = { decision: "search" as const, query: "agency program deadline", clarification: "", consequential: true };
const requests = async () => (await fetch("http://localhost:54322/__research_requests")).json();
const run = (signal = AbortSignal.timeout(5000)) => runResearch({ assessment, history, signal, offset: 0, progress: () => {} });

test.describe("Google grounding contract", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "Requires offline fixtures");
  test.beforeEach(async () => {
    await resetMocks();
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_BASE_URL = "http://localhost:54322/gemini";
  });
  test("preserves wording and adds only citations from source mappings", () => {
    const result = groundAnswer(text, fixture(), 3);
    expect(result.text).toBe(text + " [4]");
    expect(result.sources[0]).toMatchObject({ marker: "4", url: "https://agency.gov/program" });
    expect(result.html).toContain("Search Google");
    expect(result.sources[0].evidenceKind).toBeUndefined();
  });
  for (const missing of ["webSearchQueries", "groundingChunks", "groundingSupports", "searchEntryPoint"] as const) {
    test(`withholds answers missing ${missing}`, () => {
      const data = fixture(); delete data[missing];
      expect(() => groundAnswer(text, data, 0)).toThrow();
    });
  }
  test("rejects invented references, mismatched text, unsafe links and missing paragraph coverage", () => {
    const data = fixture(); data.groundingSupports![0].groundingChunkIndices = [99];
    expect(() => groundAnswer(text, data, 0)).toThrow();
    const mismatch = fixture(); mismatch.groundingSupports![0].segment!.text = "Invented text";
    expect(() => groundAnswer(text, mismatch, 0)).toThrow();
    const unsafe = fixture(); unsafe.groundingChunks![0].web!.uri = "javascript:alert(1)";
    expect(() => groundAnswer(text, unsafe, 0)).toThrow();
    expect(() => groundAnswer(text + "\n\nEveryone qualifies.", fixture(), 0)).toThrow();
  });
  test("rejects references written by the model instead of supplied by grounding", () => {
    for (const answer of [text + " [99]", text + " https://invented.example/source"]) {
      expect(() => groundAnswer(answer, fixture(answer), 0)).toThrow();
    }
  });
  test("handles UTF-8 citation offsets without changing the answer", () => {
    const answer = "Café applications close today.";
    const data = fixture(answer); data.groundingSupports![0].segment!.endIndex = Buffer.byteLength(answer);
    expect(groundAnswer(answer, data, 0).text).toBe(answer + " [1]");
  });
  test("punctuation violations fail closed instead of rewriting a Google answer", () => {
    const answer = "Today\u2014applications close.";
    expect(() => groundAnswer(answer, fixture(answer), 0)).toThrow();
  });
  test("research sends only the public query and returns Google attribution", async () => {
    const result = await runResearch({ assessment: { ...assessment, newsRoundup: true }, history: [...history, { role: "system", content: "PRIVATE_FILE_CONTENT" }], signal: AbortSignal.timeout(5000), offset: 0, progress: () => {} });
    expect(result.text).toBe(text + " [1]");
    expect(result.research).toMatchObject({ groundingProvider: "google", status: "complete", extractedPages: 0 });
    const calls = await requests();
    expect(calls).toHaveLength(1);
    expect(calls[0].native.contents).toEqual([{ role: "user", parts: [{ text: assessment.query }] }]);
    expect(JSON.stringify(calls)).not.toContain("PRIVATE_FILE_CONTENT");
    expect(JSON.stringify(calls[0].native.systemInstruction)).toContain("software vulnerabilities");
    expect(result.research.sources[0].evidence).toBeUndefined();
  });
  test("missing grounding never exposes raw model text", async () => {
    await control({ grounding: {}, groundedText: "UNCHECKED_CLAIM" });
    const result = await run();
    expect(result.research.status).toBe("insufficient_evidence");
    expect(result.text).not.toContain("UNCHECKED_CLAIM");
  });
  test("provider unavailability is not reported as unsupported evidence", async () => {
    await control({ webFailure: true });
    expect((await run()).research.status).toBe("unavailable");
  });
  test("deadline applies to the Google request", async () => {
    await control({ webDelayMs: 500 });
    expect((await run(AbortSignal.timeout(50))).research.status).toBe("timeout");
  });
  test("grounded results are not transformed into workspace artifacts", async () => {
    const result = await runResearch({ assessment: { ...assessment, action: "create_flashcards" }, history, signal: AbortSignal.timeout(5000), offset: 0, progress: () => {} });
    expect(result.action).toBeUndefined();
    expect(result.research.limitations.join(" ")).toContain("own materials");
    expect(await tableRows("flashcard_decks")).toHaveLength(0);
    expect(await requests()).toHaveLength(1);
  });
  test("routing rejects unsafe queries and explicit-search conflicts", async () => {
    await control({ assessment: { ...assessment, query: "email person@example.com" } });
    await expect(assessResearch(history, AbortSignal.timeout(5000))).rejects.toThrow();
    await control({ assessment: { decision: "ordinary", query: "", clarification: "", consequential: false } });
    await expect(assessResearch(history, AbortSignal.timeout(5000))).rejects.toThrow();
  });
});

test.describe("Google research in chat", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "Requires offline fixtures");
  test.beforeEach(async ({ context, page }) => { await resetMocks(); await signIn(context); await page.goto("/chats"); });
  test("inline citations and sandboxed Google suggestions survive reload without a Sources list", async ({ page }) => {
    await page.getByLabel("Chat message").fill("Research the deadline");
    await page.getByLabel("Chat message").press("Enter");
    const answer = page.getByRole("article", { name: "Selrano response" });
    await expect(answer).toContainText(text, { timeout: 20000 });
    await expect(page.locator('section[aria-busy="false"]')).toBeVisible();
    await expect(answer.locator('a[href="https://agency.gov/program"]')).toBeVisible();
    await expect(answer.getByText("Sources", { exact: true })).toHaveCount(0);
    await expect(page.getByTitle("Google Search suggestions")).toHaveAttribute("sandbox", "allow-popups allow-popups-to-escape-sandbox");
    await expect(page.frameLocator('iframe[title="Google Search suggestions"]').getByRole("link", { name: "Search Google" })).toBeVisible();
    const rows = await tableRows("chat_messages");
    expect(rows.find((r) => r.role === "assistant")?.research).toMatchObject({ groundingProvider: "google" });
    await page.reload();
    await expect(answer).toContainText(text);
    await expect(page.getByTitle("Google Search suggestions")).toBeVisible();
    await page.getByLabel("Chat message").fill("What about eligibility?");
    await page.getByLabel("Chat message").press("Enter");
    await expect(page.locator('section[aria-busy="false"]')).toBeVisible();
    const assessments = (await requests()).filter((r: any) => r.stage === "research_assessment");
    expect(JSON.stringify(assessments.at(-1).input)).not.toContain(text);
  });
  test("failed grounding keeps the answer hidden", async ({ page }) => {
    await control({ grounding: {}, groundedText: "UNCHECKED_CLAIM" });
    await page.getByLabel("Chat message").fill("Research the deadline");
    await page.getByLabel("Chat message").press("Enter");
    await expect(page.getByRole("article", { name: "Selrano response" })).toContainText("couldn't support", { timeout: 20000 });
    await expect(page.getByText("UNCHECKED_CLAIM")).toHaveCount(0);
    await expect(page.getByTitle("Google Search suggestions")).toHaveCount(0);
  });
});

test("retention deletes only expired new Google-grounded assistant replies", async () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "Requires offline fixtures");
  const { createClient } = await import("@supabase/supabase-js");
  const { expireGroundedHistory } = await import("../lib/grounded-history");
  const { seed } = await import("./support/session");
  await resetMocks();
  const base = { role: "assistant", content: "Keep or expire", research: { groundingProvider: "google" }, created_at: "2026-10-22T00:00:00.000Z" };
  await seed("chat_messages", [
    { ...base, id: "expired" },
    { ...base, id: "recent", created_at: "2028-01-01T00:00:00.000Z" },
    { ...base, id: "legacy", created_at: "2026-10-20T00:00:00.000Z" },
    { ...base, id: "ordinary", research: null },
    { ...base, id: "user", role: "user" }
  ]);
  await expireGroundedHistory(createClient("http://localhost:54321", "test-service-key"), new Date("2028-10-23T00:00:00.000Z"));
  expect((await tableRows("chat_messages")).map((r) => r.id).sort()).toEqual(["legacy", "ordinary", "recent", "user"]);
});


test("history cleanup requires the server cron secret", async ({ request }) => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "Requires offline fixtures");
  expect((await request.get("/api/cron/grounded-history")).status()).toBe(401);
  expect((await request.get("/api/cron/grounded-history", { headers: { authorization: "Bearer incorrect" } })).status()).toBe(401);
});
