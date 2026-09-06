import { describe, expect, it } from "vitest";
import { readSecurityRequest } from "./request";
describe("bounded scan and copilot requests", () => {
  it("parses valid JSON", async () => {
    expect(
      await readSecurityRequest(
        new Request("https://example.com", {
          method: "POST",
          body: '{"message":"Help"}',
        }),
      ),
    ).toEqual({ message: "Help" });
  });
  it("rejects chunked oversized bodies before parsing", async () => {
    await expect(
      readSecurityRequest(
        new Request("https://example.com", {
          method: "POST",
          body: "x".repeat(100),
        }),
        50,
      ),
    ).rejects.toThrow(/too large/);
  });
});
