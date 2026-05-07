import { NextResponse } from "next/server";
import { PLAN_AMOUNTS, isPaidPlan } from "@/lib/billing";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { addLocalPayment } from "@/lib/localStore";

export async function POST(request: Request) {
  if (process.env.ENABLE_TEST_PAYMENTS !== "true") {
    return NextResponse.json(
      { error: "test payments are disabled. Use /api/checkout/session in production." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const applicationId = String(body.application_id || "");
  const streamerId = String(body.streamer_id || "");
  const viewerId = String(body.viewer_id || "");
  const planType = String(body.plan_type || "");
  const amount = Number(body.amount || 0);
  const payerEmail = String(body.payer_email || "");

  if ((!applicationId && !streamerId && !viewerId) || !isPaidPlan(planType)) {
    return NextResponse.json({ error: "invalid payment request" }, { status: 400 });
  }
  if (amount !== PLAN_AMOUNTS[planType]) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }

  const db = getAdminDb();
  if (!db) {
    const payment = await addLocalPayment({
      application_id: applicationId || undefined,
      streamer_id: streamerId || undefined,
      viewer_id: viewerId || undefined,
      plan_type: planType,
      amount,
      payer_email: payerEmail
    });
    return NextResponse.json({ payment, source: "local" }, { status: 201 });
  }

  try {
    const paymentRef = db.collection("payments").doc();
    await db.runTransaction(async (tx) => {
      const applicationRef = applicationId ? db.collection("applications").doc(applicationId) : undefined;
      const streamerRef = streamerId ? db.collection("streamers").doc(streamerId) : undefined;
      const viewerRef = viewerId ? db.collection("viewer_profiles").doc(viewerId) : undefined;
      if (applicationRef) {
        const applicationDoc = await tx.get(applicationRef);
        if (!applicationDoc.exists) throw new Error("application not found");
      }
      if (streamerRef) {
        const streamerDoc = await tx.get(streamerRef);
        if (!streamerDoc.exists) throw new Error("streamer not found");
      }
      if (viewerRef) {
        const viewerDoc = await tx.get(viewerRef);
        if (!viewerDoc.exists) throw new Error("viewer not found");
      }

      tx.set(paymentRef, {
        application_id: applicationId || null,
        streamer_id: streamerId || null,
        viewer_id: viewerId || null,
        plan_type: planType,
        amount,
        payer_email: payerEmail,
        status: "paid",
        provider: "test",
        created_at: FieldValue.serverTimestamp()
      });
      if (applicationRef) {
        tx.update(applicationRef, {
          payment_status: "paid",
          paid_at: FieldValue.serverTimestamp()
        });
      }
      if (streamerRef) {
        tx.update(streamerRef, {
          plan_type: planType,
          upgraded_at: FieldValue.serverTimestamp()
        });
      }
      if (viewerRef && planType === "viewer_paid") {
        tx.set(viewerRef, {
          viewer_plan: "viewer_paid",
          subscription_status: "active",
          upgraded_at: FieldValue.serverTimestamp()
        }, { merge: true });
      }
    });

    return NextResponse.json({ id: paymentRef.id, source: "firestore" }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "application not found" }, { status: 404 });
  }
}
