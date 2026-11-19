import { expect, test, type Page } from "@playwright/test";
import { control, groqRequests, resetMocks, signIn, tableRows } from "./support/session";

// Personal finance through a fake Plaid (e2e/support/mock-servers.mjs) and a
// stand-in for the Plaid Link script that reports a connected test bank.

const composer = '[aria-label="Chat message"]';
const bubbles = 'article[aria-label="Selrano response"]';

async function fakePlaidLink(page: Page) {
  await page.route("https://cdn.plaid.com/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.Plaid = { create(config) { return { open() { setTimeout(() => config.onSuccess("public-sandbox-1", { institution: { institution_id: "ins_109508", name: "First Platypus Bank" } }), 50); } }; } };`
    })
  );
}

async function connectBank(page: Page) {
  await fakePlaidLink(page);
  await page.goto("/money");
  await page.getByRole("button", { name: "Connect a bank" }).first().click();
  await expect(page.getByText("Bank connected.")).toBeVisible({ timeout: 20_000 });
}

async function plaid() {
  return (await fetch("http://localhost:54322/__plaid")).json() as Promise<{ requests: Array<{ path: string; body: Record<string, unknown> }>; removed: string[] }>;
}

async function ask(page: Page, text: string) {
  const before = await page.locator(bubbles).count();
  await page.locator(composer).fill(text);
  await page.locator(composer).press("Enter");
  await expect(page.locator(bubbles)).toHaveCount(before + 1, { timeout: 25_000 });
  await expect(page.locator('section[aria-busy="false"]')).toBeVisible({ timeout: 25_000 });
}

test.describe("money", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs the local fake services");
  // The app's service worker would fetch the Plaid script itself, bypassing the test's stand-in.
  test.use({ serviceWorkers: "block" });

  test.beforeEach(async ({ context }) => {
    await resetMocks();
    await signIn(context);
  });

  test("connecting a bank brings in accounts, spending, income and subscriptions", async ({ page }) => {
    await fakePlaidLink(page);
    await page.goto("/money");
    await expect(page.getByText("Test mode")).toBeVisible();
    await expect(page.getByText("Connect your first bank")).toBeVisible();
    await page.getByRole("button", { name: "Connect a bank" }).click();
    await expect(page.getByText("Bank connected.")).toBeVisible({ timeout: 20_000 });

    // Spending leaves out income and the credit card payment.
    await expect(page.getByLabel("This month")).toContainText("$1,312.14");
    await expect(page.getByLabel("This month")).toContainText("$2,500.00");
    await expect(page.getByLabel("This month")).toContainText("$15.49 a month");
    await expect(page.getByLabel("Spending by category")).toContainText("Rent and utilities");
    await expect(page.getByLabel("Spending by category")).toContainText("$96.65");
    await expect(page.getByLabel("Accounts")).toContainText("First Platypus Bank");
    await expect(page.getByLabel("Accounts")).toContainText("Everyday Checking");
    await expect(page.getByLabel("Accounts")).toContainText("$412.14 owed");
    await expect(page.getByLabel("Subscriptions and bills")).toContainText("Netflix");
    await expect(page.getByLabel("Subscriptions and bills")).not.toContainText("City Gym");
    await expect(page.getByLabel("Recent transactions")).toContainText("+$2,500.00");

    const [item] = await tableRows("plaid_items");
    expect(item.access_token_encrypted).toMatch(/^v1\./);
    expect(JSON.stringify(item)).not.toContain("access-sandbox-1");
    expect(item.cursor).toBe("cursor-2");
    expect(item.institution_name).toBe("First Platypus Bank");
    expect(await tableRows("plaid_transactions")).toHaveLength(6);
    const created = (await plaid()).requests.find((r) => r.path === "/link/token/create");
    expect(created?.body.products).toEqual(["transactions"]);
  });

  test("chat answers money questions from the bank data, without a web search", async ({ page }) => {
    await connectBank(page);
    await page.goto("/chats");
    await control({ toolQueue: [{ name: "money_summary", args: { start: "2026-01-01", end: "2099-12-31" } }] });
    await ask(page, "How much did I spend this month?");
    const answers = (await groqRequests()).filter((r) => r.stream);
    expect(answers[0].systemText).toContain("bank and card accounts are connected read-only");
    const withTools = answers.find((r) => String(r.toolText || "").includes("spent"));
    expect(withTools?.toolText).toContain("spent $1,312.14, income $2,500.00");
    expect(withTools?.toolText).toContain("- Rent and utilities: $1,200.00");
    // A question about the owner's own money skips routing: no clarifying question, no web search.
    const routed = await (await fetch("http://localhost:54322/__research_requests")).json();
    expect(routed.filter((r: any) => r.stage === "research_assessment")).toHaveLength(0);
    expect((await (await fetch("http://localhost:54322/__web_requests")).json()).length).toBe(0);

    await control({ toolQueue: [{ name: "money_transactions", args: { query: "chipotle" } }, { name: "money_recurring", args: {} }] });
    await ask(page, "When did I last eat at Chipotle, and what subscriptions do I have?");
    const later = (await groqRequests()).filter((r) => r.stream).map((r) => String(r.toolText || ""));
    expect(later.some((text) => text.includes("Chipotle $14.25 out") && text.includes("(Rewards Card 3333)"))).toBe(true);
    expect(later.some((text) => text.includes("Netflix: $15.49 monthly"))).toBe(true);

    // The next turn sees that earlier answers came from the bank data, so it will not "take them back".
    await ask(page, "thanks");
    const [last] = (await groqRequests()).filter((r) => r.stream).slice(-1);
    expect(last.assistantText).toContain("Checked at the time against: the user's connected bank data.");
    const saved = (await tableRows("chat_messages")).filter((m) => m.role === "assistant");
    expect(saved[0].citations).toEqual([expect.objectContaining({ kind: "tool", label: "the user's connected bank data" })]);
  });

  test("a question about other people's money still goes through routing", async ({ page }) => {
    await connectBank(page);
    await page.goto("/chats");
    await ask(page, "What are the current federal tax brackets?");
    const routed = await (await fetch("http://localhost:54322/__research_requests")).json();
    expect(routed.find((r: any) => r.stage === "research_assessment")?.input.connectedAccounts).toBe("bank and card accounts");
  });

  test("the same bank cannot be connected twice", async ({ page }) => {
    await connectBank(page);
    await page.getByRole("button", { name: "Connect a bank" }).first().click();
    await expect(page.getByText("First Platypus Bank is already connected.")).toBeVisible();
    expect((await plaid()).requests.filter((r) => r.path === "/item/public_token/exchange")).toHaveLength(1);
    expect(await tableRows("plaid_items")).toHaveLength(1);
  });

  test("a bank that needs signing in again says so", async ({ page, request }) => {
    await connectBank(page);
    await fetch("http://localhost:54322/__plaid", { method: "POST", body: JSON.stringify({ loginRequired: true }) });
    expect((await page.request.post("/api/plaid/items/item_1")).status()).toBe(500);
    await page.reload();
    await expect(page.getByRole("button", { name: "Sign in again" })).toBeVisible();
    expect((await tableRows("plaid_items"))[0].status).toBe("login_required");
    void request;
  });

  test("disconnecting removes the bank at Plaid and deletes its data", async ({ page }) => {
    await connectBank(page);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Disconnect First Platypus Bank" }).click();
    await expect(page.getByText("First Platypus Bank is disconnected.")).toBeVisible();
    expect((await plaid()).removed).toEqual(["access-sandbox-1"]);
    expect(await tableRows("plaid_items")).toHaveLength(0);
    expect(await tableRows("plaid_accounts")).toHaveLength(0);
    expect(await tableRows("plaid_transactions")).toHaveLength(0);
  });

  test("without a bank, chat offers no money tools", async ({ page }) => {
    await page.goto("/chats");
    await ask(page, "How much did I spend this month?");
    const [answer] = (await groqRequests()).filter((r) => r.stream);
    expect(answer.systemText).not.toContain("bank and card accounts are connected");
  });
});
