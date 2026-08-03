import { NextResponse } from "next/server";
import { serializeError } from "@/lib/serialize-error";
import { assertProjectLimit } from "@/lib/tier";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: existing, error: existingError } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (existingError) throw existingError;
    if (existing?.[0]) {
      return NextResponse.json({ project: existing[0], created: false });
    }

    const limitError = await assertProjectLimit(supabase, user.id);
    if (limitError) {
      return NextResponse.json({ error: limitError, code: "plan_limit", reason: "projects" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name: "Fall 2026",
        description:
          "Your first class workspace. Upload a syllabus or lecture notes, then ask Selrano from this project."
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ project: data, created: true });
  } catch (error) {
    const message = serializeError(error);
    console.error("[onboarding/bootstrap]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
