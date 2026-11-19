import { expect, test } from "@playwright/test";
import { resetMocks, setUserEmail, signIn } from "./support/session";

// Selrano is a private personal AI (owner decision, 2026-11-19): a landing page
// and sign-in are open, everything else needs an account on ALLOWED_EMAILS, and
// nothing is indexed.

test("the landing page offers sign in and sells nothing", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("calm place to think");
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
  const text = (await page.locator("body").innerText()).toLowerCase();
  for (const word of ["waitlist", "pricing", "pro plan", "free plan", "flashcard", "quizlet", "/ month"]) {
    expect(text, word).not.toContain(word);
  }
  await expect(page.getByLabel("Email address")).toHaveCount(0);
});

test("search engines are asked to skip every page", async ({ page, request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \/\s*$/m);
  expect(robots).not.toMatch(/Allow:/);
  expect(robots).not.toMatch(/Sitemap:/);
  // No sitemap exists; the private gate sends the request to sign in.
  const sitemap = await request.get("/sitemap.xml", { maxRedirects: 0 });
  expect([307, 308, 404], String(sitemap.status())).toContain(sitemap.status());
  await page.goto("/");
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1);
});

test("retired public pages are gone or send visitors to sign in", async ({ page }) => {
  for (const path of ["/pricing", "/guides", "/changelog", "/d/some-deck", "/flashcards", "/study", "/support"]) {
    const response = await page.goto(path);
    const url = page.url();
    expect(response?.status() === 404 || /\/signin/.test(url), `${path} -> ${response?.status()} ${url}`).toBe(true);
  }
  await page.goto("/signup");
  await expect(page).toHaveURL(/\/signin$/);
});

test("retired public APIs are gone", async ({ request }) => {
  expect((await request.post("/api/waitlist", { data: { email: "reader@school.edu" } })).status()).toBe(404);
  expect((await request.get("/api/billing/status")).status()).toBe(404);
});

test("sign in and the legal pages stay open", async ({ page }) => {
  for (const path of ["/signin", "/reset-password", "/terms", "/privacy", "/security"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page, path).toHaveURL(new RegExp(`${path}$`));
  }
  await page.goto("/signin");
  await expect(page.getByLabel(/password/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /create account|waitlist/i })).toHaveCount(0);
});

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/chats");
  await expect(page).toHaveURL(/signin\?next=%2Fchats/);
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

  test("the allowed account goes straight to the app", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/chats/);
    expect((await page.request.post("/api/projects", { data: { name: "Home" } })).status()).toBe(200);
  });

  test("an account that is not on the list is refused everywhere", async ({ page }) => {
    await setUserEmail("someone.else@example.test");
    expect((await page.request.post("/api/projects", { data: { name: "Mine" } })).status()).toBe(401);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/signin\?private=1/);
    await expect(page.getByText("This Selrano is private.")).toBeVisible();
  });
});
