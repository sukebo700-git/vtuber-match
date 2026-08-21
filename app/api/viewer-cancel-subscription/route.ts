import { NextResponse } from "next/server";
import { readUserSession, viewerSessionCookie } from "@/lib/userSession";
import { getViewerEntitlement, setViewerEntitlement } from "@/lib/viewerEntitlements";

// 配信者側(app/api/withdrawal/cancel-subscription)と同じ方針: 解約はStripe側の
// 期間末日を待たず即時解約・即時ダウングレードする。customer.subscription.deleted
// webhookも後から届くが、同じsubscriptionIdであれば冪等に何もしない(害はない)。
type StripeCancelResult =
  | { ok: true; alreadyCanceled?: boolean; resourceMissing?: boolean }
  | { ok: false; message: string; code?: string; status: number };

export async function POST(request: Request) {
  const session = readUserSession<{ id?: string }>(request, viewerSessionCookie);
  if (!session?.id) return NextResponse.json({ error: "viewer login required" }, { status: 401 });

  const entitlement = await getViewerEntitlement(session.id);
  if (entitlement.tier !== "elite") {
    return NextResponse.json({ ok: true, skipped: "already_free" });
  }

  if (!entitlement.stripeSubscriptionId) {
    console.error("Viewer subscription cancellation failed", {
      reason: "missing_subscription_id",
      viewer_id: session.id,
    });
    return NextResponse.json({
      error: "Stripeの契約IDが見つからないため解約できませんでした。お問い合わせください。",
      code: "MISSING_STRIPE_SUBSCRIPTION_ID",
    }, { status: 409 });
  }

  const result = await cancelStripeSubscription(entitlement.stripeSubscriptionId);
  if (!result.ok) {
    return NextResponse.json({
      error: "解約に失敗しました。時間をおいてもう一度お試しください。",
      code: result.code || "STRIPE_CANCEL_FAILED",
    }, { status: 502 });
  }

  await setViewerEntitlement(session.id, { tier: "free", validUntil: null, grantSource: "stripe" });
  return NextResponse.json({
    ok: true,
    stripe: result.resourceMissing ? "resource_missing_treated_as_canceled" : result.alreadyCanceled ? "already_canceled" : "canceled",
  });
}

async function cancelStripeSubscription(subscriptionId: string): Promise<StripeCancelResult> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return { ok: false, message: "Stripe is not configured", code: "STRIPE_NOT_CONFIGURED", status: 500 };

  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const text = await response.text();
  const data = parseJson(text);
  if (response.ok) return { ok: true, alreadyCanceled: data?.status === "canceled" };

  const stripeError = data?.error || {};
  console.error("Viewer Stripe subscription cancellation failed", {
    status: response.status,
    subscription_id_tail: subscriptionId.slice(-6),
    error_type: stripeError.type || "",
    error_code: stripeError.code || "",
    error_message: stripeError.message || text.slice(0, 500),
  });

  if (stripeError.code === "resource_missing" || (stripeError.type === "invalid_request_error" && /No such subscription/i.test(String(stripeError.message || "")))) {
    return { ok: true, resourceMissing: true };
  }

  return {
    ok: false,
    message: String(stripeError.message || "Stripe subscription cancel failed"),
    code: String(stripeError.code || stripeError.type || "STRIPE_CANCEL_FAILED"),
    status: response.status,
  };
}

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
