import { expect, test } from "@playwright/test";
import { resetMocks, signIn, tableRows } from "./support/session";

const composer = '[aria-label="Chat message"]';
const bubbles = 'article[aria-label="Selrano response"]';

test.describe("Today", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "Today tests need the local mock servers.");

  test.beforeEach(async ({ context }) => {
    await resetMocks();
    await signIn(context);
  });

  test("signing in lands on Today, with cards that invite the next step", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^(Good (morning|afternoon|evening)|Still up), Test\.$/);
    await expect(page.getByRole("region", { name: "Coming up" }).getByRole("link", { name: "Connect Google" })).toBeVisible();
    await expect(page.getByRole("region", { name: "This month" }).getByRole("link", { name: "Connect a bank" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Pick up where you left off" })).toContainText("Your conversations will show up here");
    await expect(page.getByRole("region", { name: "Pinned memories" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Today" }).first()).toHaveAttribute("aria-current", "page");
  });

  test("a connected calendar shows what is coming up", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("link", { name: "Connect Google" }).click();
    await expect(page).toHaveURL(/\/settings\?google=connected/);
    await page.goto("/dashboard");
    await expect(page.getByRole("region", { name: "Coming up" })).toContainText("Dentist");
    await expect(page.getByRole("region", { name: "Coming up" })).toContainText("Main St");
  });

  test("a message typed on Today opens a new chat and is answered", async ({ page }) => {
    await page.goto("/dashboard");
    await page.locator(composer).fill("What should I focus on this afternoon?");
    await page.locator(composer).press("Enter");
    await expect(page).toHaveURL(/\/chats/);
    await expect(page.locator(bubbles)).toHaveCount(1, { timeout: 25_000 });
    await expect(page.locator('section[aria-busy="false"]')).toBeVisible({ timeout: 25_000 });
    await expect(page).toHaveURL(/\/chats\?thread=/);
    expect(await tableRows("chat_threads")).toHaveLength(1);
  });

  test("a starter on Today sends straight away", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Summarize my notes" }).click();
    await expect(page.locator(bubbles)).toHaveCount(1, { timeout: 25_000 });
    const user = (await tableRows("chat_messages")).find((row) => row.role === "user");
    expect(user?.content).toContain("Summarize what is in my notes");
  });
});

test.describe("notices and confirmations", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "These tests need the local mock servers.");

  test.beforeEach(async ({ context }) => {
    await resetMocks();
    await signIn(context);
  });

  test("saving and deleting a note confirms each step", async ({ page }) => {
    await page.goto("/notes");
    await page.getByLabel("Note title").fill("Groceries");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Note created" })).toBeVisible();
    expect((await tableRows("notes"))[0].title).toBe("Groceries");

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Delete this note?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Delete", exact: true })).toBeFocused();

    // Escape closes the window and keeps the note.
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(await tableRows("notes")).toHaveLength(1);

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Note deleted" })).toBeVisible();
    expect(await tableRows("notes")).toHaveLength(0);
  });
});
