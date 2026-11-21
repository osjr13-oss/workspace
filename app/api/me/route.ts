import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Who is signed in, for the iPhone app to confirm the account is on the allowlist. */
export async function GET() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const fullName = String(profile?.full_name || user.user_metadata?.full_name || "").trim();
  return NextResponse.json({ id: user.id, email: user.email, fullName });
}
