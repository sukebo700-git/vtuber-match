import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { readLocalApplications, updateLocalApplication, updateLocalStreamer } from "@/lib/localStore";
import { creatorSessionCookie, readUserSession } from "@/lib/userSession";

type CreatorSession = {
  email?: string;
  application_id?: string;
  streamer_id?: string;
  creator_login_id?: string;
};

type StripeCancelResult =
  | { ok: true; alreadyCanceled?: boolean; resourceMissing?: boolean }
  | { ok: false; message: string; code?: string; status: number };

export async function POST(request: Request) {
  const session = readUserSession<CreatorSession>(request, creatorSessionCookie);
  if (!session?.email && !session?.application_id && !session?.streamer_id && !session?.creator_login_id) {
    return NextResponse.json({ error: "creator login required" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    const applications = await readLocalApplications();
    const application = applications.find((item) => (
      Boolean(session.application_id && item.id === session.application_id) ||
      Boolean(session.streamer_id && item.streamer_id === session.streamer_id) ||
      Boolean(session.creator_login_id && item.creator_login_id === session.creator_login_id) ||
      Boolean(session.email && item.email.toLowerCase() === String(session.email).toLowerCase())
    ));
    if (!application) return NextResponse.json({ error: "application not found" }, { status: 404 });
    await updateLocalApplication(application.id, { subscription_status: "canceled", payment_status: "not_required" });
    if (application.streamer_id) await updateLocalStreamer(application.streamer_id, { plan_type: "free" });
    return NextResponse.json({ ok: true, source: "local" });
  }

  const applicationDoc = await findApplicationDoc(db, session);
  if (!applicationDoc?.exists) return NextResponse.json({ error: "application not found" }, { status: 404 });
  const application = applicationDoc.data() || {};
  const streamerId = String(session.streamer_id || application.streamer_id || "");
  const streamerDoc = streamerId ? await db.collection("streamers").doc(streamerId).get() : undefined;
  const streamer = streamerDoc?.data() || {};
  const subscriptionId = String(application.stripe_subscription_id || streamer.stripe_subscription_id || "").trim();
  const planType = String(streamer.plan_type || application.desired_plan || "free");
  const isPaidPlan = planType === "paid" || planType === "boost" || application.subscription_status === "active" || streamer.subscription_status === "active";

  if (!isPaidPlan) {
    await markCanceled(db, applicationDoc.ref, streamerId);
    return NextResponse.json({ ok: true, source: "firestore", skipped: "already_free" });
  }

  if (!subscriptionId) {
    console.error("Stripe subscription cancellation failed", {
      reason: "missing_subscription_id",
      application_id: applicationDoc.id,
      streamer_id: streamerId || "",
    });
    return NextResponse.json({
      error: "Stripeの契約IDが見つからないため、有料プランを解約できませんでした。管理者にお問い合わせください。",
      code: "MISSING_STRIPE_SUBSCRIPTION_ID"
    }, { status: 409 });
  }

  const result = await cancelStripeSubscription(subscriptionId);
  if (!result.ok) {
    return NextResponse.json({
      error: "有料プランの解約に失敗しました。時間をおいてもう一度お試しください。",
      code: result.code || "STRIPE_CANCEL_FAILED"
    }, { status: 502 });
  }

  await markCanceled(db, applicationDoc.ref, streamerId);
  return NextResponse.json({
    ok: true,
    source: "firestore",
    stripe: result.resourceMissing ? "resource_missing_treated_as_canceled" : result.alreadyCanceled ? "already_canceled" : "canceled"
  });
}

async function cancelStripeSubscription(subscriptionId: string): Promise<StripeCancelResult> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error("Stripe subscription cancellation failed", {
      reason: "missing_stripe_secret_key",
      subscription_id_tail: subscriptionId.slice(-6),
    });
    return { ok: false, message: "Stripe is not configured", code: "STRIPE_NOT_CONFIGURED", status: 500 };
  }

  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    }
  });

  const text = await response.text();
  const data = parseJson(text);
  if (response.ok) {
    return { ok: true, alreadyCanceled: data?.status === "canceled" };
  }

  const stripeError = data?.error || {};
  console.error("Stripe subscription cancellation failed", {
    status: response.status,
    subscription_id_tail: subscriptionId.slice(-6),
    error_type: stripeError.type || "",
    error_code: stripeError.code || "",
    error_message: stripeError.message || text.slice(0, 500),
    error_param: stripeError.param || "",
  });

  if (stripeError.code === "resource_missing" || stripeError.type === "invalid_request_error" && /No such subscription/i.test(String(stripeError.message || ""))) {
    return { ok: true, resourceMissing: true };
  }

  return {
    ok: false,
    message: String(stripeError.message || "Stripe subscription cancel failed"),
    code: String(stripeError.code || stripeError.type || "STRIPE_CANCEL_FAILED"),
    status: response.status,
  };
}

async function markCanceled(db: NonNullable<ReturnType<typeof getAdminDb>>, applicationRef: FirebaseFirestore.DocumentReference, streamerId: string) {
  await db.runTransaction(async (transaction) => {
    transaction.set(applicationRef, {
      subscription_status: "canceled",
      payment_status: "not_required",
      updated_at: FieldValue.serverTimestamp()
    }, { merge: true });
    if (streamerId) {
      transaction.set(db.collection("streamers").doc(streamerId), {
        plan_type: "free",
        subscription_status: "canceled",
        updated_at: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  });
}

async function findApplicationDoc(db: NonNullable<ReturnType<typeof getAdminDb>>, session: CreatorSession) {
  if (session.application_id) return db.collection("applications").doc(String(session.application_id)).get();
  if (session.creator_login_id) {
    const snapshot = await db.collection("applications").where("creator_login_id", "==", String(session.creator_login_id)).limit(1).get();
    if (snapshot.docs[0]) return snapshot.docs[0];
  }
  if (session.streamer_id) {
    const snapshot = await db.collection("applications").where("streamer_id", "==", String(session.streamer_id)).limit(1).get();
    if (snapshot.docs[0]) return snapshot.docs[0];
  }
  if (session.email) {
    const snapshot = await db.collection("applications").where("email", "==", String(session.email).toLowerCase()).limit(1).get();
    return snapshot.docs[0];
  }
  return undefined;
}

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
