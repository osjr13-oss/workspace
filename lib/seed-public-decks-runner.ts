import type { SupabaseClient } from "@supabase/supabase-js";
import { PUBLIC_SEED_DECKS } from "@/lib/seed-public-decks-data";

export type SeedPublicDecksResult = {
  created: number;
  updated: number;
  decks: Array<{ slug: string; name: string; urlPath: string; cardCount: number }>;
};

/**
 * Upsert the public starter decks for a user.
 * Uses the admin client so Free plan deck limits do not block publishing.
 */
export async function seedPublicDecksForUser(
  admin: SupabaseClient,
  userId: string
): Promise<SeedPublicDecksResult> {
  const { data: priorLimits } = await admin.from("user_limits").select("*").eq("user_id", userId).maybeSingle();

  const elevatePayload = {
    user_id: userId,
    tier: "pro",
    daily_requests: 500,
    subscription_status: "active",
    stripe_customer_id: priorLimits?.stripe_customer_id ?? null,
    stripe_subscription_id: priorLimits?.stripe_subscription_id ?? null,
    current_period_end: priorLimits?.current_period_end ?? null,
    referral_bonus_active: priorLimits?.referral_bonus_active ?? false,
    referral_bonus_until: priorLimits?.referral_bonus_until ?? null
  };

  const { error: elevateError } = await admin.from("user_limits").upsert(elevatePayload);
  if (elevateError) throw elevateError;

  let created = 0;
  let updated = 0;
  const decks: SeedPublicDecksResult["decks"] = [];

  try {
    for (const deck of PUBLIC_SEED_DECKS) {
      const { data: existing } = await admin
        .from("flashcard_decks")
        .select("id")
        .eq("share_slug", deck.slug)
        .maybeSingle();

      let deckId = existing?.id as string | undefined;

      if (deckId) {
        const { error: updateError } = await admin
          .from("flashcard_decks")
          .update({
            name: deck.name,
            is_public: true,
            user_id: userId,
            updated_at: new Date().toISOString()
          })
          .eq("id", deckId);
        if (updateError) throw updateError;
        updated += 1;

        const { error: deleteCardsError } = await admin.from("flashcards").delete().eq("deck_id", deckId);
        if (deleteCardsError) throw deleteCardsError;
      } else {
        const { data: inserted, error: insertError } = await admin
          .from("flashcard_decks")
          .insert({
            user_id: userId,
            name: deck.name,
            is_public: true,
            share_slug: deck.slug
          })
          .select("id")
          .single();
        if (insertError) throw insertError;
        deckId = inserted.id;
        created += 1;
      }

      const rows = deck.cards.map((card) => ({
        user_id: userId,
        deck_id: deckId,
        front: card.front,
        back: card.back,
        due_at: new Date().toISOString()
      }));

      const { error: cardsError } = await admin.from("flashcards").insert(rows);
      if (cardsError) throw cardsError;

      decks.push({
        slug: deck.slug,
        name: deck.name,
        urlPath: `/d/${deck.slug}`,
        cardCount: deck.cards.length
      });
    }
  } finally {
    if (priorLimits) {
      const { error: restoreError } = await admin.from("user_limits").upsert(priorLimits);
      if (restoreError) console.error("[seed-public-decks] restore limits failed", restoreError);
    } else {
      const { error: restoreError } = await admin.from("user_limits").upsert({
        user_id: userId,
        tier: "free",
        daily_requests: 20,
        subscription_status: null,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        current_period_end: null
      });
      if (restoreError) console.error("[seed-public-decks] restore free limits failed", restoreError);
    }
  }

  return { created, updated, decks };
}
