import { NextResponse } from "next/server";
import { isLocalDate, localDate } from "@/lib/dates";
import { saveTargets, type HealthProfile } from "@/lib/health-profile";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Log a weigh-in. An automatic target follows the newest weight, so it is
 * recomputed here; a double tap with the same clientId is stored once.
 */
export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as { weightKg?: unknown; date?: unknown; note?: unknown; clientId?: unknown; source?: unknown };
    const weightKg = Number(body.weightKg);
    if (!(weightKg >= 20 && weightKg <= 400)) return NextResponse.json({ error: "Enter a weight between 20 and 400 kg (44 to 880 lb)." }, { status: 400 });

    const { data: profile, error: profileError } = await supabase.from("health_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (profileError) throw profileError;
    const timezone = (profile as HealthProfile | null)?.timezone || "UTC";
    const today = localDate(timezone);
    const day = isLocalDate(body.date) && body.date <= today ? body.date : today;
    const clientId = typeof body.clientId === "string" && /^[0-9a-f-]{36}$/i.test(body.clientId) ? body.clientId : null;

    const row = {
      user_id: user.id,
      local_date: day,
      measured_at: day === today ? new Date().toISOString() : `${day}T12:00:00Z`,
      weight_kg: Math.round(weightKg * 100) / 100,
      note: typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null,
      source: body.source === "chat" ? "chat" : "manual",
      client_id: clientId
    };
    const { data: entry, error } = clientId
      ? await supabase.from("weight_entries").upsert(row, { onConflict: "user_id,client_id", ignoreDuplicates: false }).select("*").single()
      : await supabase.from("weight_entries").insert(row).select("*").single();
    if (error) throw error;

    let target = null;
    if (profile && (profile as HealthProfile).onboarded_at && day === today) {
      target = await saveTargets(supabase, user.id, profile as HealthProfile, row.weight_kg);
    }
    return NextResponse.json({ entry, target });
  } catch (error) {
    console.error("[health/weight]", serializeError(error));
    return NextResponse.json({ error: "Could not save that weight. Please try again." }, { status: 500 });
  }
}
