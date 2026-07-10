import { NextResponse } from "next/server";
import { clientIp, logAudit } from "@/lib/audit";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deleteStoragePrefix } from "@/lib/storage";
import { getStripe } from "@/lib/stripe";
import { getUserLimits } from "@/lib/tier";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limits = await getUserLimits(supabase, user.id);
    if (limits.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = getStripe();
        const subscription = await stripe.subscriptions.retrieve(limits.stripe_subscription_id);
        if (subscription.status !== "canceled") {
          await stripe.subscriptions.cancel(subscription.id);
        }
      } catch (billingError) {
        const code = typeof billingError === "object" && billingError && "code" in billingError ? billingError.code : null;
        if (code !== "resource_missing") throw billingError;
      }
    }

    await logAudit({
      user_id: user.id,
      action: "account.delete",
      ip: clientIp(request)
    });

    const admin = createSupabaseAdminClient();
    await deleteStoragePrefix(admin, "workspace-files", user.id);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = serializeError(error);
    console.error("[account/delete]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
