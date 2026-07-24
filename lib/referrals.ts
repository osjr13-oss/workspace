import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateSlug } from "@/lib/slug";

const REFERRALS_REQUIRED = 3;
const BONUS_DAYS = 30;
const MAX_CODE_ATTEMPTS = 5;

/**
 * Lazily assigns a referral code the first time it's read. Writes go through
 * the service role because user_limits has no client-side update policy.
 * all mutation of tier/limit fields is server-controlled by design.
 */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("user_limits")
    .select("referral_code")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.referral_code) return existing.referral_code;

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateSlug(8);
    const { data, error } = await admin
      .from("user_limits")
      .update({ referral_code: code })
      .eq("user_id", userId)
      .select("referral_code")
      .single();

    if (!error) return data.referral_code as string;
    if (error.code !== "23505") throw error;
  }

  throw new Error("Could not generate a unique referral code.");
}

export async function getReferralStats(supabase: SupabaseClient, userId: string) {
  const { count } = await supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", userId);

  const { data: limits } = await supabase
    .from("user_limits")
    .select("referral_bonus_active, referral_bonus_until")
    .eq("user_id", userId)
    .maybeSingle();

  const bonusUntil = limits?.referral_bonus_until || null;
  const bonusActive = Boolean(limits?.referral_bonus_active) && Boolean(bonusUntil) && new Date(bonusUntil) > new Date();

  return {
    referralCount: count || 0,
    required: REFERRALS_REQUIRED,
    bonusActive,
    bonusUntil
  };
}

/**
 * Records a referral for a newly-signed-up user and grants the referrer a
 * Pro-equivalent bonus once they cross REFERRALS_REQUIRED. Called server-side
 * only (auth callback / welcome flow), never reachable from the client.
 * the referrals table has no client insert policy.
 */
export async function captureReferral(code: string | null | undefined, referredUserId: string): Promise<void> {
  const trimmed = code?.trim();
  if (!trimmed) return;

  const admin = createSupabaseAdminClient();

  const { data: referrer } = await admin
    .from("user_limits")
    .select("user_id")
    .eq("referral_code", trimmed)
    .maybeSingle();

  if (!referrer || referrer.user_id === referredUserId) return;

  const { error: insertError } = await admin
    .from("referrals")
    .insert({ referrer_id: referrer.user_id, referred_id: referredUserId });

  if (insertError) {
    // A unique violation means this user was already credited to someone or retried.
    if (insertError.code === "23505") return;
    console.error("[referrals] capture failed", insertError);
    return;
  }

  const { count } = await admin
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referrer.user_id);

  if ((count || 0) < REFERRALS_REQUIRED) return;

  const { data: limits } = await admin
    .from("user_limits")
    .select("referral_bonus_active, referral_bonus_until")
    .eq("user_id", referrer.user_id)
    .maybeSingle();

  const currentlyActive =
    Boolean(limits?.referral_bonus_active) &&
    Boolean(limits?.referral_bonus_until) &&
    new Date(limits!.referral_bonus_until as string) > new Date();

  if (currentlyActive) return;

  const bonusUntil = new Date(Date.now() + BONUS_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error: updateError } = await admin
    .from("user_limits")
    .update({ referral_bonus_active: true, referral_bonus_until: bonusUntil })
    .eq("user_id", referrer.user_id);

  if (updateError) console.error("[referrals] bonus grant failed", updateError);
}
