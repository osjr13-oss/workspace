import { expect, test } from "@playwright/test";
import { resetMocks, setUserEmail, signIn } from "./support/session";

// Selrano's pages are public, but sign-ups are closed (owner decision, 2026-10-21).

test("the landing page is public", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: /get started/i }).first()).toBeVisible();
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
