import { NextResponse } from "next/server";
import { searchFoods } from "@/lib/food-db";
import { allowRequest } from "@/lib/rate-limit";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { removeEmDashes } from "@/lib/text";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const query = removeEmDashes(new URL(request.url).searchParams.get("q") || "").trim().slice(0, 100);
    if (query.length < 2) return NextResponse.json({ foods: [] });
    if (!(await allowRequest("food_search", user.id, 60, 60))) {
      return NextResponse.json({ error: "Searching too quickly. Wait a moment and try again." }, { status: 429 });
    }
    const result = await searchFoods(query);
    if (result.outcome !== "ok") {
      return NextResponse.json({ error: "Food search is not responding right now. You can still add the food by hand." }, { status: 503 });
    }
    return NextResponse.json({ foods: result.foods });
  } catch (error) {
    console.error("[foods/search]", serializeError(error));
    return NextResponse.json({ error: "Food search failed. Please try again." }, { status: 500 });
  }
}
