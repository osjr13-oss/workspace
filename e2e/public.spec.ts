import { expect, test } from "@playwright/test";
import { resetMocks, setUserEmail, signIn } from "./support/session";

// Selrano's pages are public, but sign-ups are closed (owner decision, 2026-10-21).

test("the landing page is public and offers the waitlist, not a dead-end sign-up", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("calm place to think");
  await expect(page.getByLabel("Email address").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Join the waitlist" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /get started/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
});

test.describe("waitlist", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs the local fake Supabase");
  test.beforeEach(async () => {
    await resetMocks();
  });

  test("joining stores the email and confirms", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email address").first().fill("Reader@School.edu ");
    await page.getByRole("button", { name: "Join the waitlist" }).first().click();
    await expect(page.getByText("You're on the list.")).toBeVisible();
    const rows = (await (await fetch("http://localhost:54321/__table?name=pro_waitlist")).json()) as { email: string; source: string }[];
    expect(rows).toEqual([expect.objectContaining({ email: "reader@school.edu", source: "signup_waitlist" })]);
  });

  test("a repeat sign-up still confirms without a second row", async ({ page, request }) => {
    expect((await request.post("/api/waitlist", { data: { email: "again@school.edu" } })).status()).toBe(200);
    await page.goto("/signup");
    await page.getByLabel("Email address").fill("again@school.edu");
    await page.getByRole("button", { name: "Join the waitlist" }).click();
    await expect(page.getByText("You're on the list.")).toBeVisible();
    const rows = (await (await fetch("http://localhost:54321/__table?name=pro_waitlist")).json()) as unknown[];
    expect(rows).toHaveLength(1);
  });

  test("an invalid email is refused with a message", async ({ page, request }) => {
    expect((await request.post("/api/waitlist", { data: { email: "someone@example.com" } })).status()).toBe(400);
    await page.goto("/");
    await page.getByLabel("Email address").first().fill("not-an-email");
    await page.getByRole("button", { name: "Join the waitlist" }).first().click();
    await expect(page.getByText("Enter a valid email address.").first()).toBeVisible();
  });
});

test("signed-out Pro checkout goes to sign in instead of the closed sign-up page", async ({ page }) => {
  await page.goto("/pricing");
  await page.getByRole("button", { name: /upgrade to pro/i }).click();
  await expect(page).toHaveURL(/\/signin\?next=(%2F|\/)pricing/);
});

test("marketing, sign-up and legal pages are open", async ({ page }) => {
  for (const path of ["/pricing", "/guides", "/changelog", "/signup", "/terms", "/privacy", "/security"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page, path).not.toHaveURL(/\/signin/);
    expect(await page.content(), path).not.toContain("support@selrano.com");
  }
});

test("removed support pages stay gone", async ({ page }) => {
  for (const path of ["/support", "/help"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }
});

test("search engines may index public pages but not the app", async ({ page, request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Allow: \//);
  expect(robots).toMatch(/Disallow: \/chats/);
  expect(robots).not.toMatch(/Disallow: \/\s*$/m);
  await page.goto("/");
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
});

test("protected routes redirect signed-out visitors to sign in", async ({ page }) => {
  await page.goto("/chats");
  await expect(page).toHaveURL(/signin\?next=%2Fchats/);
});

test("sign-ups are closed: sign-in has no create-account link and sign-up says so", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /create account/i })).toHaveCount(0);
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Sign-ups are closed" })).toBeVisible();
  await expect(page.getByLabel(/password/i)).toHaveCount(0);
});

test.describe("accounts", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs the local fake Supabase");
  test.beforeEach(async ({ context }) => {
    await resetMocks();
    await signIn(context);
  });
  test.afterEach(async () => {
    await resetMocks();
  });

  test("a signed-in visit to the landing page goes to the app", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/chats/);
  });

  test("any signed-up account can use the app", async ({ page }) => {
    await setUserEmail("someone.new@example.test");
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings/);
    const api = await page.request.get("/api/billing/status");
    expect(api.status()).not.toBe(401);
  });
});
