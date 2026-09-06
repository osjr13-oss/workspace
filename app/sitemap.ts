import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/brand";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "/",
    "/pricing",
    "/guides",
    "/sample-report",
    "/support",
    "/security",
    "/privacy",
    "/terms",
    "/changelog",
  ].map((path) => ({
    url: absoluteUrl(path),
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.5,
  }));
}
