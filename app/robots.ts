import type { MetadataRoute } from "next";

// Selrano is private (lib/access.ts), so nothing is offered to search engines.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" }
  };
}
