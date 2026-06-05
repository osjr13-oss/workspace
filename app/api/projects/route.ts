import { NextResponse } from "next/server";
import { serializeError } from "@/lib/serialize-error";
import { assertProjectLimit } from "@/lib/tier";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limitError = await assertProjectLimit(supabase, user.id);
    if (limitError) return NextResponse.json({ error: limitError, code: "plan_limit" }, { status: 403 });

    const body = (await request.json()) as { name?: string; description?: string | null };
    if (!body.name?.trim()) return NextResponse.json({ error: "Project name is required" }, { status: 400 });

    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        description: body.description?.trim() || null
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ project: data });
  } catch (error) {
    const message = serializeError(error);
    console.error("[projects]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
