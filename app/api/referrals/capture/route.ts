import { NextResponse } from "next/server";
import { serializeError } from "@/lib/serialize-error";
import { captureReferral } from "@/lib/referrals";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Called from the client right after signup when a session is established
 * immediately (email confirmation disabled). When email confirmation is on,
 * the equivalent capture happens server-side in app/auth/callback/route.ts.
 */
export async function POST(request: Request) {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { code?: string };
    await captureReferral(body.code, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = serializeError(error);
    console.error("[referrals/capture]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
