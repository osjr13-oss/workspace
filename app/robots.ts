import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/dashboard",
        "/chats",
        "/files",
        "/flashcards",
        "/notes",
        "/projects",
        "/settings",
        "/study",
        "/help",
        "/reset-password"
      ]
    },
    sitemap: absoluteUrl("/sitemap.xml")
  };
}
