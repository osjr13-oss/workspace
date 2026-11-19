import { NextResponse } from "next/server";
import { disconnectGoogle, getGoogleConnection, isGoogleConfigured } from "@/lib/google";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Whether Google is set up on the server and connected for this account. Never returns tokens. */
export async function GET() {
  const { user } = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const connection = await getGoogleConnection(user.id).catch(() => null);
  return NextResponse.json({
    configured: isGoogleConfigured(),
    connected: Boolean(connection),
    email: connection?.email ?? null
  });
}

/** Disconnect: revoke Selrano's access at Google and delete the stored tokens. */
export async function DELETE() {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await disconnectGoogle(user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = serializeError(error);
    console.error("[google] disconnect failed", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
