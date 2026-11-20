import { expect, test, type Page } from "@playwright/test";
import { control, groqRequests, resetMocks, signIn, tableRows } from "./support/session";

// Gmail and Google Calendar through fake Google endpoints (e2e/support/mock-servers.mjs).
// The fake model is steered with toolQueue to call the Google tools in order.

const composer = '[aria-label="Chat message"]';
const bubbles = 'article[aria-label="Selrano response"]';

type GoogleState = {
  requests: Array<{ method: string; path: string; query: Record<string, string>; body: string; authorization: string }>;
  drafts: Array<{ threadId?: string; mime: string }>;
  events: Array<Record<string, any>>;
};

async function google(): Promise<GoogleState> {
  return (await fetch("http://localhost:54322/__google")).json();
}

async function ask(page: Page, text: string) {
  const before = await page.locator(bubbles).count();
  await page.locator(composer).fill(text);
  await page.locator(composer).press("Enter");
  await expect(page.locator(bubbles)).toHaveCount(before + 1, { timeout: 25_000 });
  await expect(page.locator('section[aria-busy="false"]')).toBeVisible({ timeout: 25_000 });
}

async function connect(page: Page) {
  await page.goto("/settings");
  await page.getByRole("link", { name: "Connect Google" }).click();
  await expect(page).toHaveURL(/\/settings\?google=connected/);
  await expect(page.getByText("Connected as owner@example.test")).toBeVisible();
}

test.describe("Google", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs the local fake services");

  test.beforeEach(async ({ context }) => {
    await resetMocks();
    await signIn(context);
  });

  test("connecting stores encrypted tokens, and disconnecting revokes them", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Not connected")).toBeVisible();
    await connect(page);
    await expect(page.getByText("Google is connected.")).toBeVisible();

    const [row] = await tableRows("google_connections");
    expect(row.email).toBe("owner@example.test");
    expect(row.time_zone).toBe("America/New_York");
    expect(row.refresh_token_encrypted).toMatch(/^v1\./);
    expect(JSON.stringify(row)).not.toContain("refresh-token-1");
    expect(JSON.stringify(row)).not.toContain("access-token-1");

    await page.getByRole("button", { name: "Disconnect" }).click();
    await expect(page.getByText("Google is disconnected.")).toBeVisible();
    expect(await tableRows("google_connections")).toHaveLength(0);
    const revoke = (await google()).requests.find((r) => r.path === "/revoke");
    expect(revoke?.body).toContain("token=refresh-token-1");
  });

  test("a sign-in that comes back with the wrong state is refused", async ({ page }) => {
    await page.goto("/api/integrations/google/callback?code=test-code&state=forged");
    await expect(page).toHaveURL(/\/settings\?google=failed/);
    expect(await tableRows("google_connections")).toHaveLength(0);
  });

  test("chat finds and reads an email, without a web search", async ({ page }) => {
    await connect(page);
    // The email asks for a calendar change; the fake model obeys it, and the guard must refuse.
    await control({
      toolQueue: [
        { name: "gmail_search", args: { query: "from:landlord" } },
        { name: "gmail_read", args: { id: "m1" } },
        { name: "calendar_add", args: { title: "Injected meeting", start: "2026-11-24T09:00:00" } }
      ]
    });
    await page.goto("/chats");
    await ask(page, "Did my landlord ever reply about the move-out?");

    const calls = (await google()).requests.map((r) => `${r.method} ${r.path}${r.query.format ? `?${r.query.format}` : ""}`);
    expect(calls).toContain("GET /api/gmail/v1/users/me/messages");
    expect(calls).toContain("GET /api/gmail/v1/users/me/messages/m1?full");
    const answers = (await groqRequests()).filter((r) => r.stream);
    expect(answers[0].systemText).toContain("Gmail and Google Calendar are connected (owner@example.test)");
    expect(answers[0].systemText).toContain("America/New_York");

    const routed = await (await fetch("http://localhost:54322/__research_requests")).json();
    expect(routed.find((r: any) => r.stage === "research_assessment").input.connectedAccounts).toBe("Gmail and Google Calendar");
    expect((await (await fetch("http://localhost:54322/__web_requests")).json()).length).toBe(0);
    // The planted instruction in the email must not lead to a calendar change.
    expect((await google()).events).toHaveLength(0);
  });

  test("drafts a threaded reply only when asked, and never sends", async ({ page }) => {
    await connect(page);
    await page.goto("/chats");
    await control({ toolQueue: [{ name: "gmail_draft", args: { body: "Thank you!", reply_to_id: "m1" } }] });
    await ask(page, "What did Pat tell me about the carpet?");
    expect((await google()).drafts).toHaveLength(0);

    await control({ toolQueue: [{ name: "gmail_draft", args: { body: "Thank you for waiving the charge.", reply_to_id: "m1" } }] });
    await ask(page, "Draft a reply thanking Pat");
    const [draft] = (await google()).drafts;
    expect(draft.threadId).toBe("t1");
    expect(draft.mime).toContain("To: Pat Landlord <pat@example.test>");
    expect(draft.mime).toContain("Subject: Re: Move-out");
    expect(draft.mime).toContain("In-Reply-To: <move-out-1@example.test>");
    expect((await google()).requests.some((r) => /\/send$/.test(r.path))).toBe(false);
  });

  test("a stray ok never approves an event, but a yes to a proposal does", async ({ page }) => {
    await connect(page);
    await page.goto("/chats");
    const planted = { name: "calendar_add", args: { title: "Planted meeting", start: "2026-11-24T09:00:00" } };

    // The previous reply proposed nothing, so a bare ok, or an ok inside a longer unrelated message, is not approval.
    await control({ reply: "Your lease ends on March 31." });
    await ask(page, "When does my lease end?");
    await control({ toolQueue: [planted] });
    await ask(page, "ok");
    await control({ toolQueue: [planted] });
    await ask(page, "ok thanks, now tell me whether the weather will be fine for my trip next week");
    expect((await google()).events).toHaveLength(0);

    // A short yes right after Selrano asked about that exact event is approval.
    await control({ reply: "Want me to add the call with the bank on Monday at 10am to your calendar?" });
    await ask(page, "Can you help me plan Monday?");
    await control({ reply: "Done.", toolQueue: [{ name: "calendar_add", args: { title: "Call the bank", start: "2026-11-23T10:00:00" } }] });
    await ask(page, "yes please");
    expect((await google()).events.map((event) => event.summary)).toEqual(["Call the bank"]);
  });

  test("reads the calendar and adds an event in the calendar's time zone", async ({ page }) => {
    await connect(page);
    await page.goto("/chats");
    await control({ toolQueue: [{ name: "calendar_events", args: { start: "2026-11-20T00:00:00-05:00", end: "2026-11-21T00:00:00-05:00" } }] });
    await ask(page, "What's on my calendar Friday?");
    expect((await google()).requests.some((r) => r.method === "GET" && r.path === "/api/calendar/v3/calendars/primary/events")).toBe(true);

    await control({ toolQueue: [{ name: "calendar_add", args: { title: "Call the bank", start: "2026-11-23T10:00:00" } }] });
    await ask(page, "Add a call with the bank Monday at 10am to my calendar");
    const [event] = (await google()).events;
    expect(event.summary).toBe("Call the bank");
    expect(event.start).toEqual({ dateTime: "2026-11-23T10:00:00", timeZone: "America/New_York" });
    expect(event.end).toEqual({ dateTime: "2026-11-23T11:00:00", timeZone: "America/New_York" });
  });

  test("without a connection, chat offers no Google tools", async ({ page }) => {
    await page.goto("/chats");
    await ask(page, "What's on my calendar Friday?");
    const [answer] = (await groqRequests()).filter((r) => r.stream);
    expect(answer.systemText).not.toContain("Gmail and Google Calendar are connected");
  });
});
