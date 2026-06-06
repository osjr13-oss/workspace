import { NextResponse } from "next/server";
import { clientIp, logAudit } from "@/lib/audit";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; company?: string };
    if (body.company?.trim()) {
      return NextResponse.json({ success: true });
    }

    const raw = body.email?.trim().toLowerCase();
    if (!raw) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const { supabase, user } = await getAuthenticatedUser();
    const ip = clientIp(request);

    const { error: insertError } = await supabase.from("pro_waitlist").insert({
      email: raw,
      user_id: user?.id || null,
      source: "pro_waitlist",
      ip_address: ip
    });

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ success: true, alreadyOnList: true });
      }
      throw insertError;
    }

    await logAudit(supabase, {
      user_id: user?.id || null,
      action: "waitlist.pro",
      metadata: { email: raw },
      ip
    });

    return NextResponse.json({ success: true, alreadyOnList: false });
  } catch (error) {
    const msg = serializeError(error);
    console.error("[waitlist/pro]", msg, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
