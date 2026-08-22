import { NextResponse } from "next/server";
import { serializeError } from "@/lib/serialize-error";
import { generateSlug } from "@/lib/slug";
import { normalizeDeckCategory } from "@/lib/deck-categories";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_SLUG_ATTEMPTS = 5;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { isPublic?: boolean; category?: string | null };
    const isPublic = Boolean(body.isPublic);

    let categoryPatch: { category?: string | null } = {};
    if (body.category !== undefined) {
      const category = body.category === null ? null : normalizeDeckCategory(body.category);
      if (body.category !== null && !category) {
        return NextResponse.json({ error: "Unknown subject." }, { status: 400 });
      }
      categoryPatch = { category };
    }

    const { data: deck, error: fetchError } = await supabase
      .from("flashcard_decks")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });

    if (!isPublic) {
      const { data, error } = await supabase
        .from("flashcard_decks")
        .update({ is_public: false, ...categoryPatch })
        .eq("id", id)
        .eq("user_id", user.id)
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ deck: data });
    }

    if (deck.share_slug) {
      const { data, error } = await supabase
        .from("flashcard_decks")
        .update({ is_public: true, ...categoryPatch })
        .eq("id", id)
        .eq("user_id", user.id)
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ deck: data });
    }

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const slug = generateSlug(8);
      const { data, error } = await supabase
        .from("flashcard_decks")
        .update({ is_public: true, share_slug: slug, ...categoryPatch })
        .eq("id", id)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (!error) return NextResponse.json({ deck: data });
    // A unique violation on share_slug means regenerate and retry.
      if (error.code !== "23505") throw error;
    }

    return NextResponse.json({ error: "Could not generate a unique share link. Please try again." }, { status: 500 });
  } catch (error) {
    const message = serializeError(error);
    console.error("[flashcard-decks/share]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
