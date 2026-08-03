import { NextResponse } from "next/server";
import { serializeError } from "@/lib/serialize-error";
import { seedPublicDecksForUser } from "@/lib/seed-public-decks-runner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * One-click publish of public starter decks for cold-start outreach.
 * Authenticated users can publish (or refresh) the shared starter set under their account.
 */
export async function POST() {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const result = await seedPublicDecksForUser(admin, user.id);

    return NextResponse.json({
      ok: true,
      ...result,
      message:
        result.created + result.updated > 0
          ? "Starter decks are live. Share the /d/ links from the outreach guide."
          : "No decks changed."
    });
  } catch (error) {
    const message = serializeError(error);
    console.error("[seed/public-decks]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const { PUBLIC_SEED_DECKS } = await import("@/lib/seed-public-decks-data");
    const slugs = PUBLIC_SEED_DECKS.map((deck) => deck.slug);
    const { data, error } = await admin
      .from("flashcard_decks")
      .select("share_slug, is_public, name")
      .in("share_slug", slugs)
      .eq("is_public", true);

    if (error) throw error;

    const live = new Set((data || []).map((row) => row.share_slug as string));
    return NextResponse.json({
      total: slugs.length,
      published: live.size,
      ready: live.size >= slugs.length,
      decks: PUBLIC_SEED_DECKS.map((deck) => ({
        slug: deck.slug,
        name: deck.name,
        urlPath: `/d/${deck.slug}`,
        published: live.has(deck.slug)
      }))
    });
  } catch (error) {
    const message = serializeError(error);
    console.error("[seed/public-decks]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
