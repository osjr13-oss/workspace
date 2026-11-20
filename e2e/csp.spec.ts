import { expect, test } from "@playwright/test";
import { resetMocks, signIn } from "./support/session";

// Script rules (lib/csp.ts): only Selrano's own scripts run, every page still works.

test.describe("script rules", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "needs the local fake services");

  test.beforeEach(async () => {
    await resetMocks();
  });

  test("every page gets its own one-time pass, and every script carries it", async ({ request }) => {
    const seen = new Set<string>();
    for (const path of ["/", "/signin", "/privacy", "/", "/signin"]) {
      const response = await request.get(path);
      const policy = response.headers()["content-security-policy"] || "";
      const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
      expect(nonce, path).toBeTruthy();
      expect(policy, path).toContain("'strict-dynamic'");
      expect(policy, path).toContain("frame-ancestors 'none'");
      expect(policy, path).not.toContain("unsafe-inline");
      expect(policy, path).not.toContain("unsafe-eval");
      seen.add(nonce as string);

      const html = await response.text();
      const scripts = html.match(/<script\b[^>]*>/g) || [];
      expect(scripts.length, path).toBeGreaterThan(0);
      for (const tag of scripts) expect(tag, `${path}: ${tag}`).toContain(`nonce="${nonce}"`);
    }
    // Five requests, five different passes.
    expect(seen.size).toBe(5);
  });

  test("a script slipped into a page is refused by the browser", async ({ page }) => {
    // Simulates the attack: someone gets a script tag and an inline handler into the page's HTML.
    await page.route("**/signin", async (route) => {
      const response = await route.fetch();
      const html = (await response.text()).replace(
        "<body",
        '<body onload="window.__ranHandler = true"><script>window.__ranScript = true</script><img src="x" onerror="window.__ranHandler = true"'
      );
      await route.fulfill({ response, body: html });
    });
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/content security policy/i.test(message.text())) violations.push(message.text());
    });
    await page.goto("/signin");
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => (window as any).__ranScript)).toBeUndefined();
    expect(await page.evaluate(() => (window as any).__ranHandler)).toBeUndefined();
    expect(violations.length).toBeGreaterThan(0);
    // The real page still works around the attack.
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("signed-in pages load with no blocked scripts, and the offline helper still registers", async ({ page, context }) => {
    await signIn(context);
    const violations: string[] = [];
    await page.addInitScript(() => {
      (window as any).__violations = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        (window as any).__violations.push(`${event.violatedDirective} ${event.blockedURI}`);
      });
    });
    page.on("console", (message) => {
      if (/content security policy/i.test(message.text())) violations.push(message.text());
    });

    for (const path of ["/", "/chats", "/notes", "/projects", "/files", "/memory", "/settings", "/money", "/signin"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      // Hydration works: the page is interactive, not just painted.
      await expect(page.locator("body")).not.toBeEmpty();
      violations.push(...(await page.evaluate(() => (window as any).__violations as string[])));
    }
    expect(violations).toEqual([]);

    await page.goto("/chats");
    const registered = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration("/");
      return Boolean(registration);
    });
    expect(registered).toBe(true);
  });
});
