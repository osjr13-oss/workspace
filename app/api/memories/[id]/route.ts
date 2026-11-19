import { NextResponse } from "next/server";
import { updateMemory } from "@/lib/content-memory";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Edit a memory's text, or pin and unpin it. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const body = (await request.json().catch(() => ({}))) as { content?: string; pinned?: boolean };
    if (typeof body.content === "string") {
      const result = await updateMemory(supabase, user.id, id, body.content);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if (typeof body.pinned === "boolean") {
      const { error } = await supabase.from("content_memories").update({ pinned: body.pinned }).eq("id", id).eq("user_id", user.id);
      if (error) throw error;
    }

    const { data, error } = await supabase
      .from("content_memories")
      .select("id, content, pinned, source, created_at, updated_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    return NextResponse.json({ memory: data });
  } catch (error) {
    const message = serializeError(error);
    console.error("[memories/id]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Forget a memory. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const { error } = await supabase.from("content_memories").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = serializeError(error);
    console.error("[memories/id]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
