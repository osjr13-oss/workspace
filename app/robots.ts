import type { MetadataRoute } from "next";

// Selrano is private: ask every crawler to skip the whole site.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" }
  };
}
