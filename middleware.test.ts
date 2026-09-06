import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (cookies: unknown[]) => void } }) => ({
    auth: { getUser: async () => {
      options.cookies.setAll([{ name: "refreshed", value: "test", options: {} }]);
      return { data: { user: null } };
    } }
  })
}));
afterEach(() => vi.unstubAllEnvs());

describe("document security policy", () => {
  it("forwards a unique nonce to rendering and preserves the response policy during cookie refresh", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test");
    vi.stubEnv("NODE_ENV", "production");
    const first = await middleware(new NextRequest("https://www.selrano.com/"));
    const second = await middleware(new NextRequest("https://www.selrano.com/"));
    const policy = first.headers.get("content-security-policy")!;
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy.split(";").find(part => part.trim().startsWith("script-src"))).not.toContain("unsafe-inline");
    expect(first.headers.get("x-middleware-request-content-security-policy")).toBe(policy);
    expect(second.headers.get("content-security-policy")).not.toBe(policy);
    expect(first.cookies.get("refreshed")?.value).toBe("test");
  });
  it("keeps security policy on authentication redirects", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test");
    const response = await middleware(new NextRequest("https://www.selrano.com/dashboard"));
    expect(response.status).toBe(307);
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });
});
