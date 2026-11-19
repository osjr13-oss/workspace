import { NextResponse } from "next/server";
import { removeItem, syncItem } from "@/lib/plaid";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Refresh one bank now (for example after repairing its sign-in). */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    await syncItem(user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = serializeError(error);
    console.error("[plaid/items]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Disconnect a bank and delete its accounts and transactions from Selrano. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    await removeItem(user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = serializeError(error);
    console.error("[plaid/items]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
