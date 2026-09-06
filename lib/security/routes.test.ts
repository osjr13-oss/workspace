import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { ScanResult } from "./scanner/types";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  admin: vi.fn(),
  scan: vi.fn(),
  allow: vi.fn(),
  stream: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ getAuthenticatedUser: mocks.auth }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.admin,
}));
vi.mock("@/lib/security/scanner", () => ({ runUrlScan: mocks.scan }));
vi.mock("@/lib/rate-limit", () => ({ allowRequest: mocks.allow }));
vi.mock("@/lib/tier", () => ({
  getUserLimits: vi.fn(async () => ({ tier: "free" })),
  effectiveTier: () => "free",
}));
vi.mock("@/lib/ai", () => ({
  streamAi: mocks.stream,
  configuredAiModel: () => "test-model",
}));
import { POST as startScan } from "@/app/api/scans/route";
import { GET as readScan } from "@/app/api/scans/[scanId]/route";
import { POST as copilot } from "@/app/api/scans/[scanId]/copilot/route";

type Query = {
  table: string;
  action: string;
  values?: Record<string, unknown>;
  filters: Array<[string, unknown]>;
};
const log: Query[] = [];
let storageFailure = false;
let scanVisible = true;
const report: ScanResult = {
  id: "engine-id",
  url: "https://example.com/",
  normalizedUrl: "https://example.com/",
  host: "example.com",
  status: "completed",
  score: 80,
  summary: "Review findings",
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  findings: [],
  metadata: {
    finalUrl: "https://example.com/",
    statusCode: 200,
    fetchedAt: new Date().toISOString(),
    thirdPartyScriptCount: 0,
    formCount: 0,
    trustSignalCount: 0,
    responseHeaders: {},
  },
};
function client() {
  return {
    rpc: vi.fn(async () => ({ data: true, error: null })),
    from(table: string) {
      const query: Query = { table, action: "select", filters: [] };
      log.push(query);
      const result = () => {
        if (storageFailure)
          return { data: null, error: { message: "private database error" } };
        if (query.action === "insert")
          return { data: { id: "saved-id" }, error: null };
        if (table === "security_scans")
          return {
            data: scanVisible
              ? { id: "saved-id", report, status: "completed" }
              : null,
            error: null,
          };
        return { data: [], error: null };
      };
      const builder = {
        select() {
          return builder;
        },
        insert(values: Record<string, unknown>) {
          query.action = "insert";
          query.values = values;
          return builder;
        },
        update(values: Record<string, unknown>) {
          query.action = "update";
          query.values = values;
          return builder;
        },
        eq(key: string, value: unknown) {
          query.filters.push([key, value]);
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        single: async () => result(),
        maybeSingle: async () => result(),
        then(resolve: (value: ReturnType<typeof result>) => unknown) {
          return Promise.resolve(result()).then(resolve);
        },
      };
      return builder;
    },
  };
}
let supabase: ReturnType<typeof client>;
const context = { params: Promise.resolve({ scanId: "saved-id" }) };
const request = (body: unknown) =>
  new NextRequest("https://selrano.com/api/scans", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => {
  vi.clearAllMocks();
  log.length = 0;
  storageFailure = false;
  scanVisible = true;
  supabase = client();
  mocks.auth.mockResolvedValue({ supabase, user: { id: "alice" } });
  mocks.admin.mockReturnValue(client());
  mocks.allow.mockResolvedValue(true);
  mocks.scan.mockResolvedValue({ ...report });
  vi.stubEnv("ANTHROPIC_API_KEY", "test-only-placeholder");
  mocks.stream.mockImplementation(async (_messages, options) => {
    options.onToken("First ");
    options.onToken("response\u2014complete.");
  });
});

describe("saved scan API", () => {
  it("rejects unauthenticated scans before making network requests", async () => {
    mocks.auth.mockResolvedValue({ supabase, user: null });
    expect(
      (
        await startScan(
          request({ url: "https://example.com", authorized: true }),
        )
      ).status,
    ).toBe(401);
    expect(mocks.scan).not.toHaveBeenCalled();
  });
  it("requires explicit target authorization", async () => {
    expect(
      (await startScan(request({ url: "https://example.com" }))).status,
    ).toBe(400);
    expect(mocks.scan).not.toHaveBeenCalled();
  });
  it("rejects unsafe targets before reserving or scanning", async () => {
    expect(
      (await startScan(request({ url: "http://127.0.0.1", authorized: true })))
        .status,
    ).toBe(400);
    expect(mocks.allow).not.toHaveBeenCalled();
  });
  it("fails closed on quota denial", async () => {
    mocks.allow.mockResolvedValue(false);
    expect(
      (await startScan(request({ url: "example.com", authorized: true })))
        .status,
    ).toBe(429);
    expect(mocks.scan).not.toHaveBeenCalled();
  });
  it("does not run a scan that cannot be saved", async () => {
    storageFailure = true;
    expect(
      (await startScan(request({ url: "example.com", authorized: true })))
        .status,
    ).toBe(503);
    expect(mocks.scan).not.toHaveBeenCalled();
  });
  it("saves results under the authenticated owner with the storage ID", async () => {
    const response = await startScan(
      request({
        url: "https://example.com/?token=hidden",
        authorized: true,
        user_id: "bob",
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ scanId: "saved-id" });
    expect(mocks.scan).toHaveBeenCalledWith("https://example.com/");
    expect(log.find((q) => q.action === "insert")?.values?.user_id).toBe(
      "alice",
    );
    const update = log.find((q) => q.action === "update");
    expect(update?.filters).toContainEqual(["user_id", "alice"]);
    expect((update?.values?.report as ScanResult).id).toBe("saved-id");
  });
  it("marks failures without disclosing internal errors", async () => {
    mocks.scan.mockRejectedValue(new Error("private network details"));
    const response = await startScan(
      request({ url: "example.com", authorized: true }),
    );
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private network details");
    expect(log.find((q) => q.action === "update")?.values?.status).toBe(
      "failed",
    );
  });
  it("reads scans and conversations only in the caller's ownership scope", async () => {
    expect(
      (await readScan(new Request("https://selrano.com"), context)).status,
    ).toBe(200);
    expect(
      log
        .filter((q) => q.action === "select")
        .every((q) =>
          q.filters.some(
            ([key, value]) => key === "user_id" && value === "alice",
          ),
        ),
    ).toBe(true);
  });
});

describe("report-aware streaming copilot", () => {
  it("does not accept a client-supplied report in place of an owned saved scan", async () => {
    scanVisible = false;
    expect(
      (
        await copilot(
          request({ message: "Help", scanContext: report }),
          context,
        )
      ).status,
    ).toBe(404);
    expect(mocks.stream).not.toHaveBeenCalled();
  });
  it("fails closed if quota reservation fails", async () => {
    supabase.rpc.mockResolvedValue({ data: false, error: null });
    expect((await copilot(request({ message: "Help" }), context)).status).toBe(
      429,
    );
    expect(mocks.stream).not.toHaveBeenCalled();
  });
  it("streams tokens and saves the sanitized response before sending done", async () => {
    const response = await copilot(
      request({ message: "Help\u2014please" }),
      context,
    );
    const text = await response.text();
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(text).toContain('"type":"token"');
    expect(text).toContain('"type":"done"');
    expect(text).not.toContain("\u2014");
    const messages = log.filter(
      (q) => q.table === "security_copilot_messages" && q.action === "insert",
    );
    expect(messages.map((q) => q.values?.content)).toEqual([
      "Help-please",
      "First response-complete.",
    ]);
  });
  it("persists partial text and reports interrupted streams", async () => {
    mocks.stream.mockImplementation(async (_messages, options) => {
      options.onToken("Partial answer");
      throw new Error("provider detail");
    });
    const response = await copilot(request({ message: "Help" }), context);
    const text = await response.text();
    expect(text).toContain('"type":"error"');
    expect(text).not.toContain("provider detail");
    expect(
      log.some(
        (q) =>
          q.values?.role === "assistant" &&
          q.values.content === "Partial answer",
      ),
    ).toBe(true);
  });
});
