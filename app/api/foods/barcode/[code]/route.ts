import { NextResponse } from "next/server";
import { isBarcode, lookupBarcode } from "@/lib/food-db";
import { allowRequest } from "@/lib/rate-limit";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { code } = await context.params;
    if (!isBarcode(code)) return NextResponse.json({ error: "That does not look like a barcode number." }, { status: 400 });
    if (!(await allowRequest("food_barcode", user.id, 60, 60))) {
      return NextResponse.json({ error: "Scanning too quickly. Wait a moment and try again." }, { status: 429 });
    }
    const result = await lookupBarcode(code);
    if (result.outcome === "ok") return NextResponse.json({ food: result.food });
    const messages = {
      not_found: "That product is not in the database yet. Search for it by name or add it by hand.",
      no_nutrition: "That product has no nutrition information yet. Search for it by name or add it by hand.",
      unavailable: "The barcode database is not responding right now. Try again, or add it by hand."
    } as const;
    return NextResponse.json({ error: messages[result.outcome] }, { status: result.outcome === "unavailable" ? 503 : 404 });
  } catch (error) {
    console.error("[foods/barcode]", serializeError(error));
    return NextResponse.json({ error: "Barcode lookup failed. Please try again." }, { status: 500 });
  }
}
