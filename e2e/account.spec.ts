import { expect, test } from "@playwright/test";

// Runs only when you provide a TEST account through your own environment:
//   E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("signed-in journey", () => {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run signed-in tests.");

  test.beforeEach(async ({ page }) => {
    await page.goto("/signin");
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/chats|dashboard/);
  });

  test("settings has no support section and logout works", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Help & support")).toHaveCount(0);
    await page.getByRole("button", { name: /sign out|log out/i }).first().click();
    await expect(page).toHaveURL(/signin|\/$/);
  });
});
