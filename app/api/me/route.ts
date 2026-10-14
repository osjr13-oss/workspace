import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Lets the iPhone app confirm, right after sign-in, that the account may use Selrano (lib/access.ts). */
export async function GET() {
  const { user } = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "This account does not have access to Selrano." }, { status: 401 });
  return NextResponse.json({ id: user.id, email: user.email });
}
