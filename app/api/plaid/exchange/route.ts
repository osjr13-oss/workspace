import { NextResponse } from "next/server";
import { completeLink, DuplicateBankError, isPlaidConfigured } from "@/lib/plaid";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Plaid Link finished: store the bank connection and pull its accounts and transactions. */
export async function POST(request: Request) {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isPlaidConfigured()) return NextResponse.json({ error: "Plaid is not set up on the server yet." }, { status: 503 });
    const body = (await request.json().catch(() => ({}))) as { publicToken?: string; institution?: { id?: string; name?: string } };
    if (!body.publicToken) return NextResponse.json({ error: "Missing bank connection details." }, { status: 400 });
    const itemId = await completeLink(user.id, body.publicToken, body.institution || {});
    return NextResponse.json({ itemId });
  } catch (error) {
    if (error instanceof DuplicateBankError) return NextResponse.json({ error: error.message }, { status: 409 });
    const message = serializeError(error);
    console.error("[plaid/exchange]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
