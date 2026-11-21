import { expect, test } from "@playwright/test";
import { resetMocks, setUserEmail } from "./support/session";

// The iPhone app (ios/) signs in with Supabase and sends its access token as a bearer token.

function token() {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: "00000000-0000-4000-8000-000000000001", role: "authenticated", exp: 4_102_444_800 })}.sig`;
}

test.describe("iPhone app access", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "These tests need the local mock servers.");
  test.beforeEach(async () => {
    await resetMocks();
  });

  test("the app reads the public settings it needs, and nothing secret", async ({ request }) => {
    const response = await request.get("/api/app/config");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["supabaseAnonKey", "supabaseUrl"]);
    expect(body.supabaseUrl).toBe("http://localhost:54321");
  });

  test("a bearer token from an allowed account is accepted", async ({ request }) => {
    expect((await request.get("/api/me")).status()).toBe(401);
    const me = await request.get("/api/me", { headers: { Authorization: `Bearer ${token()}` } });
    expect(me.status()).toBe(200);
    expect((await me.json()).email).toBe("student@example.test");
    const today = await request.get("/api/today", { headers: { Authorization: `Bearer ${token()}` } });
    expect(today.status()).toBe(200);
  });

  test("a bearer token from an account that is not on the list is refused", async ({ request }) => {
    await setUserEmail("someone.else@example.test");
    const me = await request.get("/api/me", { headers: { Authorization: `Bearer ${token()}` } });
    expect(me.status()).toBe(401);
    const chat = await request.post("/api/ai/chat", { headers: { Authorization: `Bearer ${token()}` }, data: { message: "hi" } });
    expect(chat.status()).toBe(401);
  });
});
