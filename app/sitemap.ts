import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/brand";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const staticRoutes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.8, changeFrequency: "monthly" },
  { path: "/changelog", priority: 0.5, changeFrequency: "weekly" },
  { path: "/support", priority: 0.4, changeFrequency: "monthly" },
  { path: "/security", priority: 0.3, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" }
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const admin = createSupabaseAdminClient();
  const { data: decks } = await admin
    .from("flashcard_decks")
    .select("share_slug, updated_at")
    .eq("is_public", true)
    .not("share_slug", "is", null);

  const deckEntries: MetadataRoute.Sitemap = (decks || []).map((deck) => ({
    url: absoluteUrl(`/d/${deck.share_slug}`),
    lastModified: deck.updated_at ? new Date(deck.updated_at) : undefined,
    changeFrequency: "monthly",
    priority: 0.6
  }));

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));

  return [...staticEntries, ...deckEntries];
}
