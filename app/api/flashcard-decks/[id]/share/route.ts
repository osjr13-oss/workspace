import { NextResponse } from "next/server";
import { serializeError } from "@/lib/serialize-error";
import { generateSlug } from "@/lib/slug";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_SLUG_ATTEMPTS = 5;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { isPublic?: boolean };
    const isPublic = Boolean(body.isPublic);

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
        .update({ is_public: false })
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
        .update({ is_public: true })
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
        .update({ is_public: true, share_slug: slug })
        .eq("id", id)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (!error) return NextResponse.json({ deck: data });
      // Unique violation on share_slug — regenerate and retry.
      if (error.code !== "23505") throw error;
    }

    return NextResponse.json({ error: "Could not generate a unique share link. Please try again." }, { status: 500 });
  } catch (error) {
    const message = serializeError(error);
    console.error("[flashcard-decks/share]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
