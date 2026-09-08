import { afterEach, expect, it, vi } from "vitest";
import { streamGroq } from "@/lib/groq";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function mock(body: string) {
  vi.stubEnv("GROQ_API_KEY", "test");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
}
const options = { model: "test", onToken: vi.fn() };
it("streams text and requires provider completion", async () => {
  mock('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n');
  expect(await streamGroq([{ role: "user", content: "Hi" }], options)).toBe(
    "Hello",
  );
});
it("rejects a dropped upstream connection after partial output", async () => {
  mock('data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n');
  await expect(streamGroq([], options)).rejects.toThrow(/unexpectedly/);
});
it("propagates in-stream errors", async () => {
  mock('data: {"error":{"message":"error"}}\n\n');
  await expect(streamGroq([], options)).rejects.toThrow(/failed/);
});
it("marks output-limit truncation as incomplete", async () => {
  mock('data: {"choices":[{"finish_reason":"length"}]}\n\n');
  await expect(streamGroq([], options)).rejects.toThrow(/limit/);
});
it("does not swallow consumer cancellation", async () => {
  mock('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n');
  await expect(
    streamGroq([], {
      ...options,
      onToken: () => {
        throw new Error("cancelled");
      },
    }),
  ).rejects.toThrow(/cancelled/);
});
