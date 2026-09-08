import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
afterEach(() => vi.unstubAllEnvs());
it("allows public hosted previews", async () => {
  vi.stubEnv("VERCEL", "1");
  expect(
    (
      await middleware(
        new NextRequest("https://selrano-preview.vercel.app", {
          headers: { host: "selrano-preview.vercel.app" },
        }),
      )
    ).status,
  ).toBe(200);
});
it("blocks legacy data APIs in the prototype", async () => {
  vi.stubEnv("VERCEL", "");
  expect(
    (
      await middleware(
        new NextRequest("http://localhost:3210/api/projects", {
          headers: { host: "localhost:3210" },
        }),
      )
    ).status,
  ).toBe(404);
});
it("applies matching CSP nonce without auth calls", async () => {
  vi.stubEnv("VERCEL", "");
  const result = await middleware(
    new NextRequest("http://localhost:3210", {
      headers: { host: "localhost:3210" },
    }),
  );
  expect(result.headers.get("content-security-policy")).toBe(
    result.headers.get("x-middleware-request-content-security-policy"),
  );
});
