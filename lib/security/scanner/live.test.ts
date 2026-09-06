import { expect, it } from "vitest";
import { runUrlScan } from "./index";

// Opt-in only. Set this to a website you own or are authorized to scan.
it.skipIf(!process.env.SELRANO_SCAN_SMOKE_URL)(
  "completes a real passive scan",
  async () => {
    const report = await runUrlScan(process.env.SELRANO_SCAN_SMOKE_URL!);
    expect(report.status).toBe("completed");
    expect(report.metadata.statusCode).toBe(200);
    expect(report.metadata.crawledPagesCount).toBeGreaterThanOrEqual(1);
    expect(report.metadata.crawledPagesCount).toBeLessThanOrEqual(10);
    expect(report.metadata.responseHeaders).not.toHaveProperty("set-cookie");
    expect(report.analysis?.builderPrompts.length).toBeGreaterThan(0);
  },
  45000,
);
