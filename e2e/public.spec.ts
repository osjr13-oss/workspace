import { expect, test } from "@playwright/test";

test("landing page renders with a sign-up path", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /get started|start/i }).first()).toBeVisible();
});

test("pricing, terms, privacy, and security pages load", async ({ page }) => {
  for (const path of ["/pricing", "/terms", "/privacy", "/security", "/changelog"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
  }
});

test("support pages and email are removed", async ({ page }) => {
  for (const path of ["/support", "/help"]) {
    const response = await page.goto(path);
    expect([404, 307, 308].includes(response?.status() ?? 0) || page.url().includes("/signin"), path).toBe(true);
  }
  await page.goto("/");
  expect(await page.content()).not.toContain("support@selrano.com");
});

test("protected routes redirect signed-out visitors to sign in", async ({ page }) => {
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.E2E_BASE_URL,
    "Redirects need Supabase configured (or E2E_BASE_URL pointing at a deployed app)."
  );
  await page.goto("/chats");
  await expect(page).toHaveURL(/signin/);
});

test("sign-in form is present", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
});
