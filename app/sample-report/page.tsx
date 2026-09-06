import { SelranoLogo } from "@/components/selrano-logo";
import { SiteFooter } from "@/components/site-footer";
import type { Metadata } from "next";
import { runStaticHtmlScan } from "@/lib/security/scanner";
import { SecurityReport } from "@/components/security/report";
export const metadata: Metadata = {
  title: "Sample security report",
  description:
    "Explore a Selrano report with evidence, fix prompts, and scan coverage.",
};
export default function SampleReportPage() {
  const scan = runStaticHtmlScan(
    "https://example.com",
    `<html><head><title>Example product</title><meta name="description" content="An example website built with AI." /><link rel="canonical" href="https://example.com" /></head><body><form action="http://example.com/login"><input type="password" /></form><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/contact">Contact</a></body></html>`,
    {
      "strict-transport-security": "max-age=31536000",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "permissions-policy": "camera=(), microphone=()",
    },
  );
  return (
    <main>
      <header className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <SelranoLogo />
      </header>
      <SecurityReport scan={scan} sample />
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SiteFooter />
      </div>
    </main>
  );
}
