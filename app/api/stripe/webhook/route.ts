import crypto from "crypto";
import { NextResponse } from "next/server";
import { getPlanAmount, isOneTimePlan, isPaidPlan, isStreamerPaidPlan } from "@/lib/billing";
import type { PlanType } from "@/lib/types";
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
    const db = getAdminDb();
    if (db && !(await reserveStripeEvent(db, String(event.id || "")))) return NextResponse.json({ received: true, duplicate: true });
    await markSubscriptionCanceled(event.data?.object || {});
    return NextResponse.json({ received: true });
  }

  if (event.type === "invoice.payment_failed" || event.type === "invoice.payment_succeeded" || event.type === "invoice.paid") {
    const db = getAdminDb();
    if (db && !(await reserveStripeEvent(db, String(event.id || "")))) return NextResponse.json({ received: true, duplicate: true });
    await markInvoicePaymentState(event.data?.object || {}, event.type === "invoice.payment_failed" ? "past_due" : "active");
    return NextResponse.json({ received: true });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data?.object || {};
  const metadata = session.metadata || {};
  const planType = String(metadata.plan_type || "");
  const currentPlan = String(metadata.current_plan || "free") as PlanType;
  const applicationId = String(metadata.application_id || "");
  const streamerId = String(metadata.streamer_id || "");
  const viewerId = String(metadata.viewer_id || "");
  const effect = normalizeEffect(metadata.effect);
  const subscriptionId = String(session.subscription || "");

  if (!isPaidPlan(planType) && !isOneTimePlan(planType)) return NextResponse.json({ error: "invalid plan" }, { status: 400 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ received: true, skipped: "firestore not configured" });

  if (isOneTimePlan(planType)) {
    if (!streamerId || !viewerId || !effect) return NextResponse.json({ error: "invalid super like metadata" }, { status: 400 });
    const activated = await activateSuperBoostFromCheckout(db, {
      eventId: String(event.id || ""),
      sessionId: String(session.id || ""),
      streamerId,
      viewerId,
      effect,
      planType,
      payerEmail: String(metadata.payer_email || session.customer_details?.email || session.customer_email || ""),
    });
    if (!activated) return NextResponse.json({ received: true, duplicate: true });
    return NextResponse.json({ received: true });
  }

  if (viewerId) return NextResponse.json({ error: "invalid viewer subscription metadata" }, { status: 400 });

  if (planType === "boost" && currentPlan === "paid") {
    const cancelResult = await cancelPreviousSubscriptionForUpgrade(db, { applicationId, streamerId, newSubscriptionId: subscriptionId });
    if (!cancelResult.ok) {
      return NextResponse.json({ error: "previous subscription cancellation failed" }, { status: 502 });
    }
  }

  if (!(await reserveStripeEvent(db, String(event.id || "")))) return NextResponse.json({ received: true, duplicate: true });

  const paymentRef = db.collection("payments").doc(String(session.id));
  await db.runTransaction(async (tx) => {
    let resolvedStreamerRef: FirebaseFirestore.DocumentReference | null = streamerId && isStreamerPaidPlan(planType)
      ? db.collection("streamers").doc(streamerId)
      : null;

    if (applicationId && isStreamerPaidPlan(planType)) {
      const applicationRef = db.collection("applications").doc(applicationId);
      const applicationDoc = await tx.get(applicationRef);
      const application = applicationDoc.exists ? applicationDoc.data() || {} : {};
      const existingStreamerId = String(application.streamer_id || "");
      resolvedStreamerRef = existingStreamerId ? db.collection("streamers").doc(existingStreamerId) : db.collection("streamers").doc();

      tx.set(applicationRef, {
        payment_status: "paid",
        payment_state: "active",
        subscription_status: "active",
        stripe_subscription_id: subscriptionId,
        paid_at: FieldValue.serverTimestamp(),
        status: "approved",
        reviewed_at: FieldValue.serverTimestamp(),
        streamer_id: resolvedStreamerRef.id,
        updated_at: FieldValue.serverTimestamp()
      }, { merge: true });

      tx.set(resolvedStreamerRef, {
        name: application.name || "",
        creator_email: application.email || "",
        youtube_url: application.youtube_url || "",
        youtube_channel_id: application.youtube_channel_id || "",
        x_account: application.x_account || "",
        thumbnails: Array.isArray(application.thumbnails) ? application.thumbnails : [],
        categories: Array.isArray(application.categories) ? application.categories : [],
        tags: Array.isArray(application.tags) ? application.tags : [],
        description: application.description || "",
        one_liner: String(application.one_liner || application.description || "").slice(0, 20),
        stream_time: application.stream_time || "",
        plan_type: planType,
        is_initial_scout: false,
        is_visible: true,
        ...(existingStreamerId ? {} : { impressions: 0, likes: 0, created_at: FieldValue.serverTimestamp() }),
        source_application_id: applicationId,
        payment_state: "active",
        subscription_status: "active",
        stripe_subscription_id: subscriptionId,
        grant_source: "stripe",
        fcm_tokens: Array.isArray(application.fcm_tokens) ? application.fcm_tokens : [],
        updated_at: FieldValue.serverTimestamp()
      }, { merge: true });
    }

    tx.set(paymentRef, {
      application_id: applicationId || null,
      streamer_id: resolvedStreamerRef?.id || streamerId || null,
      plan_type: planType,
      amount: getPlanAmount(planType, currentPlan),
      payer_email: session.customer_details?.email || session.customer_email || "",
      status: "paid",
      provider: "stripe",
      provider_session_id: session.id,
      provider_subscription_id: subscriptionId,
      billing_mode: "subscription",
      created_at: FieldValue.serverTimestamp()
    }, { merge: true });

    if (resolvedStreamerRef && isStreamerPaidPlan(planType) && !applicationId) {
      tx.set(resolvedStreamerRef, {
        plan_type: planType,
        payment_state: "active",
        subscription_status: "active",
        stripe_subscription_id: subscriptionId,
        grant_source: "stripe",
        upgraded_at: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  });

  return NextResponse.json({ received: true });
}

async function activateSuperBoostFromCheckout(db: FirebaseFirestore.Firestore, input: {
  eventId: string;
  sessionId: string;
  streamerId: string;
  viewerId: string;
  effect: "shine" | "shake";
  payerEmail: string;
  planType: string;
}) {
  let activated = false;
  await db.runTransaction(async (tx) => {
    const eventRef = db.collection("stripe_events").doc(input.eventId || input.sessionId);
    const eventDoc = await tx.get(eventRef);
    if (eventDoc.exists) return;

    const streamerRef = db.collection("streamers").doc(input.streamerId);
    const viewerRef = db.collection("viewer_profiles").doc(input.viewerId);
    const [streamerDoc, viewerDoc] = await Promise.all([tx.get(streamerRef), tx.get(viewerRef)]);
    if (!streamerDoc.exists) throw new Error("streamer not found");
    if (!viewerDoc.exists) throw new Error("viewer not found");

    const currentUntil = timestampToDate(streamerDoc.data()?.super_boost_until);
    const base = currentUntil && currentUntil.getTime() > Date.now() ? currentUntil : new Date();
    const activeUntil = new Date(base.getTime() + 72 * 60 * 60 * 1000);
    const viewerData = viewerDoc.data() || {};
    const viewerDisplayName = String(viewerData.display_name || viewerData.youtube_display_name || input.viewerId).slice(0, 80);

    tx.set(eventRef, {
      type: "checkout.session.completed",
      provider_session_id: input.sessionId,
      plan_type: input.planType,
      created_at: FieldValue.serverTimestamp(),
    });
    tx.set(streamerRef, {
      super_boost_count: FieldValue.increment(1),
      super_boost_until: activeUntil,
      super_boost_effect: input.effect,
      last_super_boost_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(db.collection("super_boosts").doc(input.sessionId || `${input.streamerId}_${input.viewerId}_${Date.now()}`), {
      streamer_id: input.streamerId,
      viewer_id: input.viewerId,
      viewer_display_name: viewerDisplayName,
      viewer_name_highlighted: true,
      effect: input.effect,
      quantity: 1,
      plan_type: input.planType,
      amount: getPlanAmount(input.planType as any),
      payer_email: input.payerEmail,
      status: "activated",
      provider_session_id: input.sessionId,
      created_at: FieldValue.serverTimestamp(),
      active_until: activeUntil,
    }, { merge: true });
    tx.set(db.collection("payments").doc(input.sessionId), {
      application_id: null,
      streamer_id: input.streamerId,
      viewer_id: input.viewerId,
      plan_type: input.planType,
      amount: getPlanAmount(input.planType as any),
      payer_email: input.payerEmail,
      status: "paid",
      provider: "stripe",
      provider_session_id: input.sessionId,
      billing_mode: "payment",
      created_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(viewerRef, {
      super_like_purchase_count: FieldValue.increment(1),
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    activated = true;
  });
  return activated;
}

async function markSubscriptionCanceled(subscription: any) {
  const db = getAdminDb();
  if (!db) return;

  const metadata = subscription.metadata || {};
  const applicationId = String(metadata.application_id || "");
  const streamerId = String(metadata.streamer_id || "");
  const subscriptionId = String(subscription.id || "");

  if (applicationId) {
    const ref = db.collection("applications").doc(applicationId);
    if (await hasDifferentActiveSubscription(ref, subscriptionId)) return;
    await ref.set({
      payment_state: "active",
      subscription_status: "canceled",
      canceled_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  if (streamerId) {
    const ref = db.collection("streamers").doc(streamerId);
    if (await hasDifferentActiveSubscription(ref, subscriptionId)) return;
    await ref.set({
      plan_type: "free",
      payment_state: "active",
      subscription_status: "canceled",
      canceled_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    }, { merge: true });
  }
}

async function markInvoicePaymentState(invoice: any, paymentState: "active" | "past_due") {
  const db = getAdminDb();
  if (!db) return;

  const subscription = await resolveInvoiceSubscription(invoice);
  const metadata = subscription?.metadata || invoice.subscription_details?.metadata || {};
  const subscriptionId = String(subscription?.id || invoice.subscription || "");
  const patch = paymentState === "past_due" ? {
    payment_state: "past_due",
    payment_failed_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  } : {
    payment_state: "active",
    payment_recovered_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };

  const applicationId = String(metadata.application_id || "");
  const streamerId = String(metadata.streamer_id || "");

  await Promise.all([
    applicationId ? setIfCurrentSubscription(db.collection("applications").doc(applicationId), subscriptionId, patch) : Promise.resolve(),
    streamerId ? setIfCurrentSubscription(db.collection("streamers").doc(streamerId), subscriptionId, patch) : Promise.resolve(),
  ]);
}

async function cancelPreviousSubscriptionForUpgrade(db: FirebaseFirestore.Firestore, input: {
  applicationId: string;
  streamerId: string;
  newSubscriptionId: string;
}): Promise<StripeCancelResult> {
  const oldId = await findExistingSubscriptionId(db, input);
  if (!oldId || oldId === input.newSubscriptionId) return { ok: true };
  const result = await cancelStripeSubscription(oldId);
  if (!result.ok) {
    console.error("Old Stripe subscription cancellation failed during upgrade", {
      subscription_id_tail: oldId.slice(-6),
      code: result.code,
      status: result.status,
    });
  }
  return result;
}

async function findExistingSubscriptionId(db: FirebaseFirestore.Firestore, input: {
  applicationId: string;
  streamerId: string;
}) {
  if (input.streamerId) {
    const doc = await db.collection("streamers").doc(input.streamerId).get();
    const id = String(doc.data()?.stripe_subscription_id || "");
    if (id) return id;
  }
  if (input.applicationId) {
    const appDoc = await db.collection("applications").doc(input.applicationId).get();
    const appData = appDoc.data() || {};
    const appSub = String(appData.stripe_subscription_id || "");
    if (appSub) return appSub;
    const streamerId = String(appData.streamer_id || "");
    if (streamerId) {
      const streamerDoc = await db.collection("streamers").doc(streamerId).get();
      const streamerSub = String(streamerDoc.data()?.stripe_subscription_id || "");
      if (streamerSub) return streamerSub;
    }
  }
  return "";
}

async function hasDifferentActiveSubscription(ref: FirebaseFirestore.DocumentReference, subscriptionId: string) {
  if (!subscriptionId) return false;
  const doc = await ref.get();
  const current = String(doc.data()?.stripe_subscription_id || "");
  return Boolean(current && current !== subscriptionId);
}

async function setIfCurrentSubscription(ref: FirebaseFirestore.DocumentReference, subscriptionId: string, patch: Record<string, unknown>) {
  if (await hasDifferentActiveSubscription(ref, subscriptionId)) return;
  await ref.set(patch, { merge: true });
}

async function resolveInvoiceSubscription(invoice: any) {
  if (invoice.subscription && typeof invoice.subscription === "object") return invoice.subscription;
  const subscriptionId = String(invoice.subscription || "");
  if (!subscriptionId) return null;
  return fetchStripeSubscription(subscriptionId);
}

async function fetchStripeSubscription(subscriptionId: string) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!response.ok) {
    const text = await response.text();
    console.error("Stripe subscription fetch failed", {
      status: response.status,
      subscription_id_tail: subscriptionId.slice(-6),
      error_message: text.slice(0, 300),
    });
    return null;
  }
  return response.json();
}

type StripeCancelResult = {
  ok: boolean;
  code?: string;
  status?: number;
};

async function cancelStripeSubscription(subscriptionId: string): Promise<StripeCancelResult> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return { ok: false, code: "STRIPE_NOT_CONFIGURED", status: 500 };

  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  const text = await response.text();
  const data = safeJson(text);
  if (response.ok) return { ok: true };

  const stripeError = data?.error || {};
  const code = String(stripeError.code || stripeError.type || "STRIPE_CANCEL_FAILED");
  if (stripeError.code === "resource_missing" || stripeError.type === "invalid_request_error" && /No such subscription/i.test(String(stripeError.message || ""))) {
    return { ok: true, code: "resource_missing", status: response.status };
  }

  console.error("Stripe subscription cancellation failed", {
    status: response.status,
    subscription_id_tail: subscriptionId.slice(-6),
    error_type: stripeError.type || "",
    error_code: stripeError.code || "",
    error_message: stripeError.message || text.slice(0, 500),
    error_param: stripeError.param || "",
  });
  return { ok: false, code, status: response.status };
}

async function reserveStripeEvent(db: FirebaseFirestore.Firestore, eventId: string) {
  if (!eventId) return true;
  let reserved = false;
  await db.runTransaction(async (tx) => {
    const eventRef = db.collection("stripe_events").doc(eventId);
    const eventDoc = await tx.get(eventRef);
    if (eventDoc.exists) return;
    tx.set(eventRef, {
      created_at: FieldValue.serverTimestamp(),
    });
    reserved = true;
  });
  return reserved;
}

function normalizeEffect(value: unknown) {
  if (value === "shine" || value === "shake") return value;
  return "shine";
}

function timestampToDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") return value.toDate();
  return null;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
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
