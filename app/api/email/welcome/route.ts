import { NextResponse } from "next/server";
import { isEmailConfigured } from "@/lib/email/send";
import { sendWelcomeEmailOnce } from "@/lib/email/templates";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const { user } = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isEmailConfigured()) return NextResponse.json({ sent: false, skipped: true });

  try {
    const sent = await sendWelcomeEmailOnce(user);
    return NextResponse.json({ sent, skipped: false });
  } catch (error) {
    console.error("[email/welcome]", serializeError(error));
    return NextResponse.json({ error: serializeError(error) }, { status: 500 });
  }
}
