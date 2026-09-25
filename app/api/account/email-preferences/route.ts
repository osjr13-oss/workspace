import { NextResponse } from "next/server";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data, error } = await supabase.from("profiles").select("lifecycle_emails").eq("id", user.id).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ lifecycleEmails: data?.lifecycle_emails === true });
  } catch (error) {
    return NextResponse.json({ error: serializeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await request.json()) as { lifecycleEmails?: boolean };
    if (typeof body.lifecycleEmails !== "boolean") {
      return NextResponse.json({ error: "lifecycleEmails must be true or false." }, { status: 400 });
    }
    const { error } = await supabase.from("profiles").update({ lifecycle_emails: body.lifecycleEmails }).eq("id", user.id);
    if (error) throw error;
    return NextResponse.json({ lifecycleEmails: body.lifecycleEmails });
  } catch (error) {
    return NextResponse.json({ error: serializeError(error) }, { status: 500 });
  }
}
