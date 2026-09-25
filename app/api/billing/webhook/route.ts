import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { invoiceSubscriptionId, setUserFree, setUserPro, subscriptionPeriodEnd } from "@/lib/billing";
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

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured." }, { status: 500 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch (error) {
    console.error("[billing/webhook] signature failed", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.user_id;
        if (!userId || !session.subscription || !session.customer) break;
        const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
        await setUserPro({
          userId,
          stripeCustomerId: String(session.customer),
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscriptionPeriodEnd(subscription)
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
            stripeCustomerId: String(subscription.customer),
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            currentPeriodEnd: subscriptionPeriodEnd(subscription)
          });
        } else if (["canceled", "unpaid", "incomplete_expired"].includes(subscription.status)) {
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
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoiceSubscriptionId(invoice);
        if (!subscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = await userIdFromSubscription(subscription);
        if (!userId || !["active", "trialing"].includes(subscription.status)) break;
        await setUserPro({
          userId,
          stripeCustomerId: String(subscription.customer),
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscriptionPeriodEnd(subscription)
        });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("[billing/webhook] handler error", event.type, error);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
