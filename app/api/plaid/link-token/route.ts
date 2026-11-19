import { NextResponse } from "next/server";
import { createLinkToken, isPlaidConfigured } from "@/lib/plaid";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** A short-lived token that opens Plaid Link, to connect a bank or (with itemId) repair a connection. */
export async function POST(request: Request) {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isPlaidConfigured()) return NextResponse.json({ error: "Plaid is not set up on the server yet." }, { status: 503 });
    const body = (await request.json().catch(() => ({}))) as { itemId?: string };
    return NextResponse.json({ linkToken: await createLinkToken(user.id, { itemId: body.itemId }) });
  } catch (error) {
    const message = serializeError(error);
    console.error("[plaid/link-token]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
