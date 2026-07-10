import { NextResponse } from "next/server";
import { clientIp } from "@/lib/audit";
import { sendWelcomeEmailOnce } from "@/lib/email/welcome";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { name?: string };
    const emailSent = await sendWelcomeEmailOnce(user, { name: body.name, ip: clientIp(request) });
    return NextResponse.json({ success: true, emailSent });
  } catch (error) {
    const msg = serializeError(error);
    console.error("[email/welcome]", msg, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
