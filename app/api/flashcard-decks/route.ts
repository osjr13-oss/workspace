import { NextResponse } from "next/server";
import { serializeError } from "@/lib/serialize-error";
import { assertDeckLimit } from "@/lib/tier";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limitError = await assertDeckLimit(supabase, user.id);
    if (limitError) return NextResponse.json({ error: limitError, code: "plan_limit", reason: "decks" }, { status: 403 });

    const body = (await request.json()) as { name?: string; projectId?: string | null };
    if (!body.name?.trim()) return NextResponse.json({ error: "Deck name is required" }, { status: 400 });

    if (body.projectId) {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("id", body.projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (projectError) throw projectError;
      if (!project) return NextResponse.json({ error: "Project not found" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("flashcard_decks")
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        project_id: body.projectId || null
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ deck: data });
  } catch (error) {
    const message = serializeError(error);
    console.error("[flashcard-decks]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
