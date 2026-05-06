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
  const subscriptionId = String(session.subscription || "");

  if (!isPaidPlan(planType)) return NextResponse.json({ error: "invalid plan" }, { status: 400 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ received: true, skipped: "firestore not configured" });

  if (applicationId) {
    const applicationRef = db.collection("applications").doc(applicationId);
    await applicationRef.set({
      payment_status: "paid",
      subscription_status: "active",
      stripe_subscription_id: subscriptionId,
      paid_at: FieldValue.serverTimestamp()
    }, { merge: true });

    const applicationDoc = await applicationRef.get();
    const application = applicationDoc.data() || {};
    if (applicationDoc.exists && application.status !== "approved") {
      const streamerRef = db.collection("streamers").doc();
      await streamerRef.set({
        name: application.name || "",
        youtube_url: application.youtube_url || "",
        youtube_channel_id: application.youtube_channel_id || "",
        thumbnails: Array.isArray(application.thumbnails) ? application.thumbnails : [],
        categories: Array.isArray(application.categories) ? application.categories : [],
        tags: Array.isArray(application.tags) ? application.tags : [],
        description: application.description || "",
        one_liner: application.one_liner || application.description || "",
        stream_time: application.stream_time || "",
        plan_type: planType,
        is_initial_scout: false,
        is_visible: true,
        impressions: 0,
        likes: 0,
        source_application_id: applicationId,
        subscription_status: "active",
        stripe_subscription_id: subscriptionId,
        created_at: FieldValue.serverTimestamp()
      });
      await applicationRef.set({
        status: "approved",
        reviewed_at: FieldValue.serverTimestamp(),
        streamer_id: streamerRef.id
      }, { merge: true });
    }
  }
  if (streamerId) {
    await db.collection("streamers").doc(streamerId).set({
      plan_type: planType,
      subscription_status: "active",
      stripe_subscription_id: subscriptionId,
      upgraded_at: FieldValue.serverTimestamp()
    }, { merge: true });
  }

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
      provider_subscription_id: subscriptionId,
      billing_mode: "subscription",
      created_at: FieldValue.serverTimestamp()
    }, { merge: true });

    if (applicationId) {
      tx.update(db.collection("applications").doc(applicationId), {
        payment_status: "paid",
        subscription_status: "active",
        stripe_subscription_id: subscriptionId,
        paid_at: FieldValue.serverTimestamp()
      });
    }
    if (streamerId) {
      tx.update(db.collection("streamers").doc(streamerId), {
        plan_type: planType,
        subscription_status: "active",
        stripe_subscription_id: subscriptionId,
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
