import { expect, test } from "@playwright/test";
import { resetMocks, setUserEmail, signIn } from "./support/session";

// Selrano is private (lib/access.ts): only sign in, password reset, and the legal pages are open.

test("signed-out visitors to the landing page are sent to sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByText(/Selrano is private/i)).toBeVisible();
});

test("marketing, signup, and shared-deck pages are closed", async ({ page }) => {
  for (const path of ["/pricing", "/guides", "/changelog", "/signup", "/d/some-deck", "/support", "/help"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/signin/);
  }
});

test("legal pages stay open", async ({ page }) => {
  for (const path of ["/terms", "/privacy", "/security"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    expect(await page.content(), path).not.toContain("support@selrano.com");
  }
});

test("search engines are turned away", async ({ page, request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \/\s*$/m);
  await page.goto("/signin");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("protected routes redirect signed-out visitors to sign in", async ({ page }) => {
  await page.goto("/chats");
  await expect(page).toHaveURL(/signin\?next=%2Fchats/);
});

test("sign-in form is present without a sign-up path", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /create account/i })).toHaveCount(0);
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

  test("an allowed account reaches the app", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/signin/);
  });

  test("the iPhone app's bearer token is accepted only for allowed accounts", async ({ playwright }) => {
    const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: "00000000-0000-4000-8000-000000000001", role: "authenticated", exp: 4_102_444_800 })}.sig`;
    // A separate request context: no browser cookies, only the token.
    const api = await playwright.request.newContext({ baseURL: "http://localhost:3000", extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const allowed = await api.get("/api/me");
    expect(allowed.status()).toBe(200);
    expect((await allowed.json()).email).toBe("student@example.test");
    await setUserEmail("stranger@example.test");
    expect((await api.get("/api/me")).status()).toBe(401);
    await api.dispose();
  });

  test("an account that is not on the allowlist is refused and signed out", async ({ page }) => {
    await setUserEmail("stranger@example.test");
    // The API refuses it while the session cookie still exists...
    const api = await page.request.post("/api/ai/chat", { data: { message: "hello" } });
    expect(api.status()).toBe(401);
    // ...and the first page visit ends the session.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/signin\?private=1/);
    await expect(page.getByText(/does not have access/i)).toBeVisible();
    const cookies = await page.context().cookies();
    expect(cookies.some((cookie) => cookie.name.startsWith("sb-") && cookie.value)).toBe(false);
  });
});
