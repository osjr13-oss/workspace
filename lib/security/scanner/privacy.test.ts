import { describe, expect, it } from "vitest";
import { runStaticHtmlScan } from "./index";
import { generateDeterministicAnalysis } from "../analysis";

describe("evidence and prompts", () => {
  it("redacts secret values before they enter findings and builder prompts", () => {
    const report = runStaticHtmlScan(
      "https://example.com",
      '<script>window.STRIPE_SECRET_KEY = "test-private-value-123456";</script>',
    );
    expect(JSON.stringify(report)).not.toContain("test-private-value-123456");
    expect(JSON.stringify(report)).toContain("STRIPE_SECRET_KEY = [REDACTED]");
  });
  it("does not offer category prompts for categories without findings", () => {
    const report = runStaticHtmlScan(
      "https://example.com",
      "<html><title>Sample</title></html>",
    );
    report.findings = report.findings.filter(
      (f) => f.category === "security_headers",
    );
    const analysis = generateDeterministicAnalysis(report);
    expect(analysis.builderPrompts.map((p) => p.id)).toEqual([
      "full-remediation",
      "security-headers",
    ]);
  });
});
