import { NextResponse } from "next/server";
import { serializeError } from "@/lib/serialize-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function authorizeExport(request: Request) {
  const secret = process.env.WAITLIST_EXPORT_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeExport(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("pro_waitlist")
      .select("email, user_id, source, ip_address, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = data || [];
    const header = "email,user_id,source,ip_address,created_at";
    const lines = rows.map((row) =>
      [
        row.email,
        row.user_id || "",
        row.source,
        row.ip_address || "",
        row.created_at
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    );

    const csv = [header, ...lines].join("\n");
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="selrano-pro-waitlist-${stamp}.csv"`
      }
    });
  } catch (error) {
    const msg = serializeError(error);
    console.error("[waitlist/export]", msg, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
