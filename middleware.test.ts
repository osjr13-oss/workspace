import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
afterEach(() => vi.unstubAllEnvs());
it("blocks hosted deployment even when the host is spoofed", async () => {
  vi.stubEnv("VERCEL", "1");
  expect(
    (
      await middleware(
        new NextRequest("http://localhost:3210", {
          headers: { host: "localhost:3210" },
        }),
      )
    ).status,
  ).toBe(403);
});
it("blocks legacy data APIs in the private prototype", async () => {
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
