import crypto from "crypto";
import { NextResponse } from "next/server";
import { PLAN_AMOUNTS, isPaidPlan } from "@/lib/billing";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || !verifyStripeSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);
  if (event.type === "customer.subscription.deleted") {
    await markSubscriptionCanceled(event.data?.object || {});
    return NextResponse.json({ received: true });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data?.object || {};
  const metadata = session.metadata || {};
  const planType = String(metadata.plan_type || "");
  const applicationId = String(metadata.application_id || "");
  const streamerId = String(metadata.streamer_id || "");

  if (!isPaidPlan(planType)) return NextResponse.json({ error: "invalid plan" }, { status: 400 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ received: true, skipped: "firestore not configured" });

  const paymentRef = db.collection("payments").doc(String(session.id));
  await db.runTransaction(async (tx) => {
    tx.set(paymentRef, {
      application_id: applicationId || null,
      streamer_id: streamerId || null,
      plan_type: planType,
      amount: PLAN_AMOUNTS[planType],
      payer_email: session.customer_details?.email || session.customer_email || "",
      status: "paid",
      provider: "stripe",
      provider_session_id: session.id,
      provider_subscription_id: session.subscription || "",
      billing_mode: "subscription",
      created_at: FieldValue.serverTimestamp()
    }, { merge: true });

    if (applicationId) {
      tx.update(db.collection("applications").doc(applicationId), {
        payment_status: "paid",
        subscription_status: "active",
        stripe_subscription_id: session.subscription || "",
        paid_at: FieldValue.serverTimestamp()
      });
    }
    if (streamerId) {
      tx.update(db.collection("streamers").doc(streamerId), {
        plan_type: planType,
        subscription_status: "active",
        stripe_subscription_id: session.subscription || "",
        upgraded_at: FieldValue.serverTimestamp()
      });
    }
  });

  return NextResponse.json({ received: true });
}

async function markSubscriptionCanceled(subscription: any) {
  const db = getAdminDb();
  if (!db) return;

  const metadata = subscription.metadata || {};
  const applicationId = String(metadata.application_id || "");
  const streamerId = String(metadata.streamer_id || "");

  if (applicationId) {
    await db.collection("applications").doc(applicationId).set({
      subscription_status: "canceled",
      canceled_at: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  if (streamerId) {
    await db.collection("streamers").doc(streamerId).set({
      plan_type: "free",
      subscription_status: "canceled",
      canceled_at: FieldValue.serverTimestamp()
    }, { merge: true });
  }
}

function verifyStripeSignature(rawBody: string, header: string, secret: string) {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    })
  );
  if (!parts.t || !parts.v1) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(parts.v1, "hex");
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}
