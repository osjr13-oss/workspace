import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/brand";
import { guides } from "@/lib/guides";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Queries the database, so it can't be statically prerendered at build time
// (no Supabase credentials are available in that context, e.g. in CI).
// force-dynamic makes Next render this on every request instead of trying
// to execute it during `next build`.
export const dynamic = "force-dynamic";

const staticRoutes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/library", priority: 0.9, changeFrequency: "daily" },
  { path: "/pricing", priority: 0.8, changeFrequency: "monthly" },
  { path: "/guides", priority: 0.6, changeFrequency: "weekly" },
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

  const guideEntries: MetadataRoute.Sitemap = guides.map((guide) => ({
    url: absoluteUrl(`/guides/${guide.slug}`),
    lastModified: new Date(`${guide.publishedAt}T00:00:00Z`),
    changeFrequency: "monthly",
    priority: 0.6
  }));

  return [...staticEntries, ...guideEntries, ...deckEntries];
}
