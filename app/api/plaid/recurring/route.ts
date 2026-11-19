import { NextResponse } from "next/server";
import { recurringPayments } from "@/lib/plaid";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Subscriptions and bills, detected by Plaid across connected banks. */
export async function GET() {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ recurring: await recurringPayments(user.id) });
  } catch (error) {
    const message = serializeError(error);
    console.error("[plaid/recurring]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
