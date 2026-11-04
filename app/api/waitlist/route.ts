import { NextResponse } from "next/server";
import { allowRequest } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Reserved domains that can never receive mail (same list as migration 016).
const PLACEHOLDER = /@(example\.(com|org|net|edu)|test(\.(com|net))?|invalid|localhost)$/i;

/**
 * Public sign-up waitlist while new accounts are closed. Rows go into the
 * existing `pro_waitlist` table with source `signup_waitlist`. A valid email
 * always gets the same answer, so the endpoint never reveals who already joined.
 */
export async function POST(request: Request) {
  let email = "";
  try {
    const body = (await request.json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  if (!email || email.length > 254 || !EMAIL.test(email) || PLACEHOLDER.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await allowRequest("waitlist.join", ip, 6, 3600))) {
    return NextResponse.json({ ok: false, error: "Too many tries. Please wait a bit and try again." }, { status: 429 });
  }

  const { error } = await createSupabaseAdminClient()
    .from("pro_waitlist")
    .upsert({ email, source: "signup_waitlist" }, { onConflict: "email", ignoreDuplicates: true });

  if (error) {
    console.error("[waitlist]", error.code, error.message);
    return NextResponse.json({ ok: false, error: "Could not join the waitlist right now. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
