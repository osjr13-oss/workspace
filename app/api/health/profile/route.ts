import { NextResponse } from "next/server";
import { localDate } from "@/lib/dates";
import { latestWeightKg, saveTargets, validateProfile, type HealthProfile } from "@/lib/health-profile";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** The profile and the target in effect today. */
export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile, error } = await supabase.from("health_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    const today = localDate((profile as HealthProfile | null)?.timezone || "UTC");
    const { data: target, error: targetError } = await supabase
      .from("daily_targets")
      .select("*")
      .eq("user_id", user.id)
      .lte("effective_date", today)
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (targetError) throw targetError;
    return NextResponse.json({ profile, target, today });
  } catch (error) {
    console.error("[health/profile]", serializeError(error));
    return NextResponse.json({ error: "Could not load your profile." }, { status: 500 });
  }
}

/**
 * Save the profile and recompute today's target. Targets are only ever written
 * here and in /api/health/weight, so the safety limits in lib/targets.ts always apply.
 */
export async function PUT(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const timezone = typeof body.timezone === "string" ? body.timezone : "UTC";
    const result = validateProfile(body, localDate(timezone));
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    const profile = result.profile;

    const { data: existing, error: existingError } = await supabase.from("health_profiles").select("onboarded_at").eq("user_id", user.id).maybeSingle();
    if (existingError) throw existingError;

    // Onboarding sends the current weight along with the profile.
    const currentWeight = Number(body.current_weight_kg);
    if (Number.isFinite(currentWeight) && body.current_weight_kg !== null && body.current_weight_kg !== "") {
      if (!(currentWeight >= 20 && currentWeight <= 400)) return NextResponse.json({ error: "Enter a weight between 20 and 400 kg (44 to 880 lb)." }, { status: 400 });
      const { error: weightError } = await supabase.from("weight_entries").insert({
        user_id: user.id,
        local_date: localDate(profile.timezone),
        weight_kg: Math.round(currentWeight * 100) / 100,
        source: "manual"
      });
      if (weightError) throw weightError;
    }
    const weightKg = await latestWeightKg(supabase, user.id);
    if (weightKg === null) return NextResponse.json({ error: "Enter your current weight." }, { status: 400 });

    const { data: saved, error } = await supabase
      .from("health_profiles")
      .upsert({ user_id: user.id, ...profile, onboarded_at: existing?.onboarded_at || new Date().toISOString() }, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw error;
    const target = await saveTargets(supabase, user.id, profile, weightKg);
    return NextResponse.json({ profile: saved, target });
  } catch (error) {
    console.error("[health/profile]", serializeError(error));
    return NextResponse.json({ error: "Could not save your profile. Please try again." }, { status: 500 });
  }
}
