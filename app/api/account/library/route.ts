import { NextResponse } from "next/server";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const [notes, decks] = await Promise.all([
      supabase.from("notes").select("id, title").order("updated_at", { ascending: false }).limit(40),
      supabase.from("flashcard_decks").select("id, name").order("updated_at", { ascending: false }).limit(40)
    ]);
    if (notes.error) throw notes.error;
    if (decks.error) throw decks.error;
    return NextResponse.json({ notes: notes.data || [], decks: decks.data || [] });
  } catch (error) {
    return NextResponse.json({ error: serializeError(error) }, { status: 500 });
  }
}
