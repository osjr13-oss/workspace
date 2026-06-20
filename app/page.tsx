import type { Metadata } from "next";
import { LaunchNav } from "@/components/launch/launch-nav";
import { HeroSection } from "@/components/launch/hero-section";
import { ProblemSection } from "@/components/launch/problem-section";
import { PipelineDemo } from "@/components/launch/pipeline-demo";
import { ScrollActs } from "@/components/launch/scroll-acts";
import { WorkspaceBridge } from "@/components/launch/workspace-bridge";
import { LaunchCta } from "@/components/launch/launch-cta";
import { SiteFooter } from "@/components/site-footer";
import { brand, absoluteUrl } from "@/lib/brand";
import "./launch.css";

export const metadata: Metadata = {
  title: `${brand.name} - AI client workspace for independent consultants`,
  description:
    "Keep client files, notes, decisions, chats, and drafts in one calm AI workspace built for independent consultants.",
  openGraph: {
    title: brand.name,
    description:
      "An AI client workspace for independent consultants. Keep every file, note, decision, and draft in one place.",
    url: brand.urls.app,
    siteName: brand.name,
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: brand.name,
    description: "One calm workspace for every client project."
  },
  alternates: {
    canonical: absoluteUrl("/")
  }
};

export default function LandingPage() {
  return (
    <main className="launch-page">
      <div className="launch-orb-bg" aria-hidden />
      <LaunchNav />
      <HeroSection />
      <ProblemSection />
      <PipelineDemo />
      <ScrollActs />
      <WorkspaceBridge />
      <LaunchCta />
      <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-6">
        <SiteFooter />
      </div>
    </main>
  );
}
