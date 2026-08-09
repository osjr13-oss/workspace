import { NextResponse } from "next/server";
import { serializeError } from "@/lib/serialize-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { lifecycleEmails?: unknown; dailyDigest?: unknown };

    const hasLifecycle = typeof body.lifecycleEmails === "boolean";
    const hasDigest = typeof body.dailyDigest === "boolean";
    if (!hasLifecycle && !hasDigest) {
      return NextResponse.json(
        { error: "lifecycleEmails or dailyDigest must be a boolean." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("profiles").upsert(
      {
        id: user.id,
        ...(hasLifecycle ? { lifecycle_emails: body.lifecycleEmails as boolean } : {}),
        ...(hasDigest ? { daily_digest: body.dailyDigest as boolean } : {}),
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    );

    if (error) throw error;

    return NextResponse.json({
      success: true,
      ...(hasLifecycle ? { lifecycleEmails: body.lifecycleEmails } : {}),
      ...(hasDigest ? { dailyDigest: body.dailyDigest } : {})
    });
  } catch (error) {
    const message = serializeError(error);
    console.error("[account/email-preferences]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
