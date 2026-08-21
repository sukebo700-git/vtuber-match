import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { adminCookieName, getCookieValue } from "@/lib/adminSession";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { deleteLocalViewerProfile, hasLocalPaymentHistory } from "@/lib/localStore";
import { getViewerEntitlement, setViewerEntitlement } from "@/lib/viewerEntitlements";

const allowedActions = ["grant_elite", "revoke_elite"] as const;
type ViewerAdminAction = (typeof allowedActions)[number];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const id = params.id;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "Firebase admin env is required" }, { status: 501 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const action = (allowedActions as readonly string[]).includes(String(body.action))
    ? (body.action as ViewerAdminAction)
    : undefined;
  if (!action) return NextResponse.json({ error: "action is required" }, { status: 400 });

  const before = await getViewerEntitlement(id);
  const tier = action === "grant_elite" ? "elite" : "free";
  // 管理付与/解除は無期限扱い(手動で外すまで有効)。Stripe経由の付与は
  // setViewerEntitlementのvalidUntilに実際の請求期間を入れる(#11で実装)。
  await setViewerEntitlement(id, { tier, validUntil: null, grantSource: "admin" });

  await db.collection("admin_audit_logs").add({
    admin_session_id: getCookieValue(request.headers.get("cookie"), adminCookieName) || request.headers.get("x-admin-key") || "unknown",
    action: `viewer_${action}`,
    target_type: "viewer",
    target_id: id,
    before: { tier: before.tier },
    after: { tier },
    created_at: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, tier });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const id = params.id;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const db = getAdminDb();
  if (!db) {
    if (await hasLocalPaymentHistory("viewer_id", id)) {
      return NextResponse.json({ error: "スーパーいいね購入履歴がある視聴者は削除できません。", code: "HAS_PAYMENT_HISTORY" }, { status: 409 });
    }
    const deleted = await deleteLocalViewerProfile(id);
    if (!deleted) return NextResponse.json({ error: "viewer not found" }, { status: 404 });
    return NextResponse.json({ deleted: true, source: "local" });
  }

  const ref = db.collection("viewer_profiles").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return NextResponse.json({ error: "viewer not found" }, { status: 404 });
  if (snapshot.data()?.is_deleted === true) return NextResponse.json({ deleted: true, source: "firestore" });
  if (await hasPaymentHistory(db, id)) {
    return NextResponse.json({ error: "スーパーいいね購入履歴がある視聴者は削除できません。", code: "HAS_PAYMENT_HISTORY" }, { status: 409 });
  }

  await ref.set({
    is_deleted: true,
    deleted_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp()
  }, { merge: true });
  await writeAuditLog(db, request, {
    action: "delete",
    target_id: id,
    before: summarizeViewer(snapshot.data() || {}),
    after: { is_deleted: true }
  });
  return NextResponse.json({ deleted: true, source: "firestore" });
}

async function hasPaymentHistory(db: FirebaseFirestore.Firestore, id: string) {
  const snapshot = await db.collection("payments").where("viewer_id", "==", id).limit(1).get();
  return !snapshot.empty;
}

async function writeAuditLog(db: FirebaseFirestore.Firestore, request: Request, input: {
  action: string;
  target_id: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}) {
  const adminSessionId = getCookieValue(request.headers.get("cookie"), adminCookieName) || request.headers.get("x-admin-key") || "unknown";
  await db.collection("admin_audit_logs").add({
    admin_session_id: adminSessionId,
    action: input.action,
    target_type: "viewer",
    target_id: input.target_id,
    before: input.before,
    after: input.after,
    created_at: FieldValue.serverTimestamp()
  });
}

function summarizeViewer(value: Record<string, unknown>) {
  return {
    viewer_plan: value.viewer_plan || "free",
    display_name: value.display_name || "",
    viewer_login_id: value.viewer_login_id || "",
    super_like_purchase_count: Number(value.super_like_purchase_count || 0),
    is_deleted: value.is_deleted === true
  };
}
