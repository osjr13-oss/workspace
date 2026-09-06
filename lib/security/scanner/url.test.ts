import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchPublicUrl,
  isPublicIpAddress,
  normalizeScanUrl,
  readTextResponse,
  resolvePublicAddresses,
} from "./url";
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (host: string) =>
    host === "mixed.test"
      ? [
          { address: "93.184.216.34", family: 4 },
          { address: "10.0.0.1", family: 4 },
        ]
      : [{ address: "93.184.216.34", family: 4 }],
  ),
}));
afterEach(() => vi.unstubAllGlobals());
describe("public network boundary", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.1.1",
    "192.168.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "198.18.0.1",
    "224.0.0.1",
    "::1",
    "::",
    "fd00::1",
    "fe80::1",
    "::ffff:7f00:1",
    "::ffff:127.0.0.1",
    "2002:7f00:1::",
    "2001:db8::1",
    "64:ff9b::7f00:1",
  ])("blocks non-public address %s", (address) =>
    expect(isPublicIpAddress(address)).toBe(false),
  );
  it.each(["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111"])(
    "accepts public address %s",
    (address) => expect(isPublicIpAddress(address)).toBe(true),
  );
  it.each([
    "http://2130706433",
    "http://0x7f000001",
    "http://127.1",
    "http://[::ffff:7f00:1]",
    "http://[::1]",
    "http://service.internal",
  ])("normalizes and blocks disguised local target %s", (url) =>
    expect(() => normalizeScanUrl(url)).toThrow(/public websites/),
  );
  it("drops query credentials and fragments", () =>
    expect(
      normalizeScanUrl("https://example.com/path?token=secret#session").href,
    ).toBe("https://example.com/path"));
  it("rejects mixed public/private DNS answers", async () => {
    await expect(resolvePublicAddresses("mixed.test")).rejects.toThrow(
      /public websites/,
    );
  });
  it("blocks a redirect to cloud metadata without making the private request", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data" },
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(fetchPublicUrl("https://example.com")).rejects.toThrow(
      /public websites/,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("revalidates DNS for redirect destinations", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://mixed.test" },
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(fetchPublicUrl("https://example.com")).rejects.toThrow(
      /public websites/,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("enforces streaming response size limits without Content-Length", async () => {
    await expect(
      readTextResponse(new Response("x".repeat(100)), 50),
    ).rejects.toThrow(/too large/);
  });
});
