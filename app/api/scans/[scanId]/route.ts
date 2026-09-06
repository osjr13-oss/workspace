import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ scanId: string }> },
) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user)
    return NextResponse.json(
      { error: "Sign in to view this scan." },
      { status: 401 },
    );
  const { scanId } = await context.params;
  const { data, error } = await supabase
    .from("security_scans")
    .select("*")
    .eq("id", scanId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data)
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  const { data: messages, error: messageError } = await supabase
    .from("security_copilot_messages")
    .select("id,role,content")
    .eq("scan_id", scanId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(40);
  if (messageError)
    return NextResponse.json(
      { error: "Copilot history is temporarily unavailable." },
      { status: 503 },
    );
  return NextResponse.json(
    { scan: data, messages: (messages || []).reverse() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
