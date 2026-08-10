import { NextResponse } from "next/server";
import { serializeError } from "@/lib/serialize-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { lifecycleEmails?: unknown };
    if (typeof body.lifecycleEmails !== "boolean") {
      return NextResponse.json({ error: "lifecycleEmails must be a boolean." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("profiles").upsert(
      {
        id: user.id,
        lifecycle_emails: body.lifecycleEmails,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    );

    if (error) throw error;

    return NextResponse.json({ success: true, lifecycleEmails: body.lifecycleEmails });
  } catch (error) {
    const message = serializeError(error);
    console.error("[account/email-preferences]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
