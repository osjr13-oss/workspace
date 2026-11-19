import { NextResponse } from "next/server";
import { cleanMemoryText, saveMemory } from "@/lib/content-memory";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

const LIST_COLUMNS = "id, content, pinned, source, created_at, updated_at";

/** Everything Selrano remembers about the signed-in user, pinned first, newest first. */
export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("content_memories")
      .select(LIST_COLUMNS)
      .eq("user_id", user.id)
      .eq("kind", "durable")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return NextResponse.json({ memories: data || [] });
  } catch (error) {
    const message = serializeError(error);
    console.error("[memories]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Add a memory by hand. */
export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { content?: string; pinned?: boolean };
    const content = cleanMemoryText(String(body.content || ""));
    if (content.length < 3) return NextResponse.json({ error: "Write a few words to remember." }, { status: 400 });

    const memory = await saveMemory(supabase, user.id, content, { source: "manual", pinned: body.pinned === true });
    if (!memory) return NextResponse.json({ error: "Could not save that memory." }, { status: 500 });
    return NextResponse.json({ memory });
  } catch (error) {
    const message = serializeError(error);
    console.error("[memories]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
