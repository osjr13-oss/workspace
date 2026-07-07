import { NextResponse } from "next/server";
import { clientIp, logAudit } from "@/lib/audit";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await logAudit({
      user_id: user.id,
      action: "account.delete",
      ip: clientIp(request)
    });

    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = serializeError(error);
    console.error("[account/delete]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
