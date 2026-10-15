import { expect, test, type Page } from "@playwright/test";
import {
  control,
  findGlitches,
  groqRequests,
  installRecorder,
  readSamples,
  resetMocks,
  seedConversation,
  setLatency,
  setQuota,
  signIn,
  tableRows
} from "./support/session";

const composer = '[aria-label="Chat message"]';
const bubbles = 'article[aria-label="Selrano response"]';

async function send(page: Page, text: string) {
  await page.locator(composer).fill(text);
  await page.locator(composer).press("Enter");
}

async function bubbleCount(page: Page) {
  return page.locator(bubbles).count();
}

/** Sends a message and waits until the turn is completely finished. */
async function sendAndSettle(page: Page, text: string) {
  const before = await bubbleCount(page);
  await send(page, text);
  await expect(page.locator(bubbles)).toHaveCount(before + 1, { timeout: 25_000 });
  await settled(page);
}

/** The chat panel marks itself busy until a reply is fully finished and saved. */
async function settled(page: Page) {
  await expect(page.locator('section[aria-busy="false"]')).toBeVisible({ timeout: 25_000 });
}

const LONG_MARKDOWN = [
  "## Study plan for organic chemistry",
  "",
  "Here is a **simple three-step plan** you can follow this week:",
  "",
  "1. **Learn the reactions** by grouping them by functional group.",
  "2. **Practice mechanisms** on paper until the arrows feel natural.",
  "3. *Test yourself* with old exams under `time pressure`.",
  "",
  "| Day | Focus | Time |",
  "|---|---|---|",
  "| Mon | Alkenes | 60 min |",
  "| Tue | Alcohols | 60 min |",
  "",
  "See [the guide](https://example.com/guide) for more [1].",
  "",
  "Keep notes short and revisit them often."
].join("\n");

test.describe("chat", () => {
  // These tests steer a fake Groq and Supabase, so they only run against the local app that starts them.
  test.skip(Boolean(process.env.E2E_BASE_URL), "Chat tests need the local mock servers.");

  test.beforeEach(async ({ page, context }) => {
    await resetMocks();
    await signIn(context);
    await page.goto("/chats");
  });

  test("a reply streams in without flashing, vanishing, or the thinking mark returning", async ({ page }) => {
    test.setTimeout(120_000);
    await installRecorder(page);
    await page.goto("/chats"); // the recorder only applies to pages loaded after it is installed
    await sendAndSettle(page, "Warm up the dev server please"); // first request compiles the route
    await setLatency(150);
    const baseline = await bubbleCount(page);
    const since = (await readSamples(page)).length;

    await sendAndSettle(page, "How do I study for organic chemistry?");
    await page.waitForTimeout(500);

    const glitches = findGlitches((await readSamples(page)).slice(since), baseline);
    expect(glitches, glitches.join("\n")).toEqual([]);
  });

  test("unfinished formatting never shows up as raw symbols while a reply streams", async ({ page }) => {
    test.setTimeout(120_000);
    await sendAndSettle(page, "warm up");
    await control({ reply: LONG_MARKDOWN, tokenDelayMs: 15 });
    await page.evaluate(() => {
      const seen: string[] = [];
      (window as any).__raw = seen;
      const raw = /\*\*|(^|\n)\s*#{1,6}\s|\|\s*-{2,}|\]\(|\[\d*$|`/;
      const tick = () => {
        const last = Array.from(document.querySelectorAll('article[aria-label="Selrano response"]')).pop() as HTMLElement | undefined;
        if (last && raw.test(last.innerText)) seen.push(last.innerText.slice(-80));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await sendAndSettle(page, "Give me a study plan");
    const seen = await page.evaluate(() => (window as any).__raw as string[]);
    expect(seen, `raw formatting was visible: ${JSON.stringify(seen.slice(0, 3))}`).toEqual([]);
    await expect(page.locator(`${bubbles} table`).last()).toBeVisible();
  });

  test("an empty model reply is retried, then reported clearly with nothing saved", async ({ page }) => {
    await sendAndSettle(page, "warm up");
    const savedBefore = (await tableRows("chat_messages")).length;
    await control({ emptyNext: 2 });
    await send(page, "Say something please");
    await expect(page.getByText(/empty reply|could not generate/i)).toBeVisible({ timeout: 25_000 });
    await settled(page);
    await expect(page.locator(composer)).toHaveValue("Say something please");
    const requests = await groqRequests();
    expect(requests.filter((r) => r.lastUser === "Say something please").length).toBeGreaterThanOrEqual(2);
    const rows = await tableRows("chat_messages");
    expect(rows.length, "the failed turn must leave nothing behind").toBe(savedBefore);
  });

  test("when the main model is rate limited the second model answers straight away", async ({ page }) => {
    await sendAndSettle(page, "warm up");
    await control({ failNext: [{ status: 429, retryAfter: 30 }] });
    const started = Date.now();
    await sendAndSettle(page, "Explain photosynthesis simply");
    expect(Date.now() - started, "should not wait out the 30 second limit").toBeLessThan(10_000);
    const models = (await groqRequests()).filter((r) => r.stream).map((r) => r.model);
    expect(models.slice(-2)).toEqual(["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
  });

  test("when every model is rate limited the user gets a clear message and keeps their text", async ({ page }) => {
    await sendAndSettle(page, "warm up");
    const savedBefore = (await tableRows("chat_messages")).length;
    const limited = { status: 429, retryAfter: 1 };
    await control({ failNext: [limited, limited, limited, limited, limited, limited] });
    await send(page, "Explain mitosis simply");
    await expect(page.getByText(/handling a lot of requests/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(composer)).toHaveValue("Explain mitosis simply");
    expect((await tableRows("chat_messages")).length).toBe(savedBefore);
    const apology = (await tableRows("chat_messages")).filter((m) => /Sorry, something went wrong/.test(String(m.content)));
    expect(apology).toEqual([]);
  });

  test("a short rate limit is waited out and the answer still arrives", async ({ page }) => {
    await sendAndSettle(page, "warm up");
    const limited = { status: 429, retryAfter: 1 };
    await control({ failNext: [limited, limited] }); // both models, then it succeeds after the wait
    await sendAndSettle(page, "Explain osmosis simply");
    await expect(page.locator(bubbles).last()).toContainText("Here is a clear answer");
  });

  test("memory work never runs in front of the answer", async ({ page }) => {
    await seedConversation(6);
    await page.goto("/chats?thread=11111111-1111-4111-8111-111111111111");
    await expect(page.locator(bubbles)).toHaveCount(6);
    await sendAndSettle(page, "What should I review tonight?");
    const requests = await groqRequests();
    const answerIndex = requests.findIndex((r) => r.stream);
    expect(answerIndex, "the answer should be the first model call").toBe(0);
    await expect.poll(async () => (await groqRequests()).length, { timeout: 15_000 }).toBeGreaterThan(1);
  });

  test("long conversations keep each request small enough for Groq's per-minute limit", async ({ page }) => {
    await seedConversation(12, 1800);
    await page.goto("/chats?thread=11111111-1111-4111-8111-111111111111");
    await expect(page.locator(bubbles)).toHaveCount(12);
    await sendAndSettle(page, "Summarize what we covered");
    const [answer] = (await groqRequests()).filter((r) => r.stream);
    expect(answer.approxTokens, `request was about ${answer.approxTokens} tokens`).toBeLessThan(3500);
  });

  test("a lead-in written before a tool call is not shown", async ({ page }) => {
    await sendAndSettle(page, "warm up");
    await control({ toolNext: true, toolPreface: "Let me look that up for you." });
    await sendAndSettle(page, "Find my notes about space missions");
    await expect(page.locator(bubbles).last()).not.toContainText("Let me look that up");
    await expect(page.locator(bubbles).last()).toContainText("Here is a clear answer");
  });

  test("leaving the page mid-answer still saves the whole answer", async ({ page }) => {
    test.setTimeout(90_000);
    await sendAndSettle(page, "warm up");
    const reply = Array.from({ length: 30 }, (_, i) => `Sentence number ${i + 1} of the long answer.`).join(" ");
    await control({ reply, tokenDelayMs: 25 });
    const before = await bubbleCount(page);
    await send(page, "Tell me something long");
    await expect(page.locator(bubbles)).toHaveCount(before + 1, { timeout: 25_000 });
    await page.goto("/pricing"); // leave while it is still streaming
    await expect
      .poll(async () => (await tableRows("chat_messages")).filter((m) => m.role === "assistant").some((m) => String(m.content).includes("Sentence number 30")), {
        timeout: 30_000
      })
      .toBe(true);
  });

  test("pressing Enter again while a reply is running does not start a second reply", async ({ page }) => {
    test.setTimeout(90_000);
    await sendAndSettle(page, "warm up");
    await control({ reply: "A slow answer. ".repeat(40), tokenDelayMs: 20 });
    const streamsBefore = (await groqRequests()).filter((r) => r.stream).length;

    await send(page, "First question");
    await page.locator(composer).fill("Second question sent too early");
    await page.locator(composer).press("Enter");
    await settled(page);

    const streams = (await groqRequests()).filter((r) => r.stream).length - streamsBefore;
    expect(streams, "only one reply should have been requested").toBe(1);
    expect(await page.locator(bubbles).count()).toBe(2);
    expect((await tableRows("chat_threads")).length, "the follow-up must stay in the same conversation").toBe(1);
    await expect(page.locator(composer)).toHaveValue("Second question sent too early");
  });

  test("a daily-limit refusal explains itself and keeps the text", async ({ page }) => {
    await setQuota(false);
    await send(page, "One more question");
    await expect(page.getByText(/limit reached/i)).toBeVisible({ timeout: 25_000 });
    await expect(page.locator(composer)).toHaveValue("One more question");
  });
});
