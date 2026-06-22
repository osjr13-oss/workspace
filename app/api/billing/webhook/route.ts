import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { setUserFree, setUserPro } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function userIdFromSubscription(subscription: Stripe.Subscription) {
  if (subscription.metadata?.user_id) return subscription.metadata.user_id;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("user_limits")
    .select("user_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();
  return data?.user_id || null;
}

async function userIdFromCustomer(customerId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("user_limits")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.user_id || null;
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (error) {
    console.error("[billing/webhook] signature failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.user_id;
        if (!userId || !session.subscription || !session.customer) break;

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await setUserPro({
          userId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000)
        });
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await userIdFromSubscription(subscription);
        if (!userId) break;

        if (["active", "trialing"].includes(subscription.status)) {
          await setUserPro({
            userId,
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000)
          });
        } else if (["canceled", "unpaid", "past_due", "incomplete_expired"].includes(subscription.status)) {
          await setUserFree(userId);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await userIdFromSubscription(subscription);
        if (userId) await setUserFree(userId);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;
        const userId = await userIdFromCustomer(customerId);
        if (userId) await setUserFree(userId);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("[billing/webhook] handler error", event.type, error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
