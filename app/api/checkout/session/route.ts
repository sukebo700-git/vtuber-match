import { NextResponse } from "next/server";
import { getAppUrl, getStripePriceId, isPaidPlan } from "@/lib/billing";
import { getAdminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const applicationId = String(body.application_id || "");
  const streamerId = String(body.streamer_id || "");
  const planType = String(body.plan_type || "");
  const payerEmail = String(body.payer_email || "");

  if ((!applicationId && !streamerId) || !isPaidPlan(planType)) {
    return NextResponse.json({ error: "invalid checkout request" }, { status: 400 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = getStripePriceId(planType);
  if (!secretKey || !priceId) {
    return NextResponse.json(
      { error: "Stripe is not configured. Set STRIPE_SECRET_KEY and price ids." },
      { status: 501 }
    );
  }

  const db = getAdminDb();
  if (db && applicationId) {
    const application = await db.collection("applications").doc(applicationId).get();
    if (!application.exists) return NextResponse.json({ error: "application not found" }, { status: 404 });
  }
  if (db && streamerId) {
    const streamer = await db.collection("streamers").doc(streamerId).get();
    if (!streamer.exists) return NextResponse.json({ error: "streamer not found" }, { status: 404 });
  }

  const appUrl = getAppUrl();
  const cancelParams = new URLSearchParams(
    applicationId ? { application_id: applicationId } : { streamer_id: streamerId, plan: planType }
  );
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${appUrl}/checkout?${cancelParams.toString()}`);
  params.set("metadata[plan_type]", planType);
  params.set("subscription_data[metadata][plan_type]", planType);
  if (applicationId) params.set("metadata[application_id]", applicationId);
  if (streamerId) params.set("metadata[streamer_id]", streamerId);
  if (applicationId) params.set("subscription_data[metadata][application_id]", applicationId);
  if (streamerId) params.set("subscription_data[metadata][streamer_id]", streamerId);
  if (payerEmail) params.set("customer_email", payerEmail);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  const session = await response.json();
  if (!response.ok) {
    return NextResponse.json({ error: session.error?.message || "Stripe checkout failed" }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
