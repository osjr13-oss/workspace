import { NextResponse } from "next/server";
import { getTodayUsageCount } from "@/lib/ai-usage";
import { getPlan } from "@/lib/plans";
import { dailyAiLimit, effectiveTier, getUserLimits } from "@/lib/tier";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limits = await getUserLimits(supabase, user.id);
  const tier = effectiveTier(limits);
  const plan = getPlan(tier);
  const aiUsedToday = await getTodayUsageCount(supabase, user.id);

  const [projects, decks] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("flashcard_decks").select("id", { count: "exact", head: true }).eq("user_id", user.id)
  ]);

  return NextResponse.json({
    tier,
    planName: plan.name,
    priceMonthly: plan.priceMonthly,
    subscriptionStatus: limits.subscription_status,
    currentPeriodEnd: limits.current_period_end,
    limits: {
      dailyAiRequests: dailyAiLimit(limits),
      maxProjects: plan.maxProjects,
      maxFileMb: plan.maxFileMb,
      maxDecks: plan.maxDecks
    },
    usage: {
      aiToday: aiUsedToday,
      projects: projects.count || 0,
      decks: decks.count || 0
    },
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRO_PRICE_ID)
  });
}
