import { readSecurityRequest } from "@/lib/security/request";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allowRequest } from "@/lib/rate-limit";
import { getUserLimits, effectiveTier } from "@/lib/tier";
import { PLANS } from "@/lib/plans";
import { runUrlScan } from "@/lib/security/scanner";
import { normalizeScanUrl } from "@/lib/security/scanner/url";
import { SCAN_COLUMNS } from "@/lib/security/types";
import { removeEmDashes } from "@/lib/text";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user)
    return NextResponse.json(
      { error: "Sign in to view scans." },
      { status: 401 },
    );
  const page = Math.max(
    0,
    Math.min(
      10000,
      Math.floor(Number(request.nextUrl.searchParams.get("page")) || 0),
    ),
  );
  const { data, error, count } = await supabase
    .from("security_scans")
    .select(SCAN_COLUMNS, { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(page * 20, page * 20 + 19);
  if (error)
    return NextResponse.json(
      { error: "Scan history is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  return NextResponse.json(
    { scans: data, total: count },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user)
    return NextResponse.json(
      { error: "Sign in to scan your website." },
      { status: 401 },
    );
  const rawBody = await readSecurityRequest(request).catch(() => null);
  const body =
    rawBody && typeof rawBody === "object"
      ? (rawBody as Record<string, unknown>)
      : null;
  if (
    !body ||
    typeof body.url !== "string" ||
    body.url.length > 2048 ||
    body.authorized !== true
  ) {
    return NextResponse.json(
      {
        error:
          "Enter a website URL and confirm you have permission to scan it.",
      },
      { status: 400 },
    );
  }
  let url: URL;
  try {
    url = normalizeScanUrl(body.url);
  } catch {
    return NextResponse.json(
      {
        error:
          "Enter a public HTTP or HTTPS website without credentials or a custom port.",
      },
      { status: 400 },
    );
  }
  const plan = PLANS[effectiveTier(await getUserLimits(supabase, user.id))];
  if (
    !(await allowRequest("security-scan", user.id, plan.scansPerDay, 86400))
  ) {
    return NextResponse.json(
      {
        error:
          "Your scan allowance is currently unavailable or reached. Try again later.",
      },
      { status: 429 },
    );
  }
  const admin = createSupabaseAdminClient();
  const { data: row, error: insertError } = await admin
    .from("security_scans")
    .insert({
      user_id: user.id,
      url: url.toString(),
      host: url.hostname,
      status: "running",
    })
    .select("id")
    .single();
  if (insertError || !row)
    return NextResponse.json(
      { error: "Scan storage is unavailable. Please try again." },
      { status: 503 },
    );
  try {
    const report = await runUrlScan(url.toString());
    report.id = row.id;
    // Apply the shared text boundary to all report strings before persistence.
    const cleanReport = JSON.parse(removeEmDashes(JSON.stringify(report)));
    const { error } = await admin
      .from("security_scans")
      .update({
        status: "completed",
        score: report.score,
        summary: removeEmDashes(report.summary),
        finding_count: report.findings.length,
        report: cleanReport,
        completed_at: report.completedAt,
      })
      .eq("id", row.id)
      .eq("user_id", user.id);
    if (error) throw new Error("storage");
    return NextResponse.json({ scanId: row.id }, { status: 201 });
  } catch {
    const failure =
      "We could not complete this scan. Check that the URL serves a public HTML page and allows automated requests, then try again.";
    await admin
      .from("security_scans")
      .update({
        status: "failed",
        failure,
        completed_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("user_id", user.id);
    return NextResponse.json(
      { error: failure, scanId: row.id },
      { status: 502 },
    );
  }
}
