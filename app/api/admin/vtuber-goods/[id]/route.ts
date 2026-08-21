import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { adminCookieName, getCookieValue } from "@/lib/adminSession";
import { FieldValue, getAdminDb, stripUndefined } from "@/lib/firebaseAdmin";
import { invalidateGoodsCache, vtuberGoodsCollection } from "@/lib/vtuberGoods";

export const dynamic = "force-dynamic";

const allowedStatuses = ["approved", "rejected", "pending"] as const;
type GoodsStatus = (typeof allowedStatuses)[number];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "Firebase admin env is required" }, { status: 501 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const status = typeof body.status === "string" && (allowedStatuses as readonly string[]).includes(body.status)
    ? (body.status as GoodsStatus)
    : undefined;
  if (!status) return NextResponse.json({ error: "statusを指定してください。" }, { status: 400 });

  const adminNote = String(body.admin_note || "").trim().slice(0, 200);

  const ref = db.collection(vtuberGoodsCollection).doc(params.id);
  const doc = await ref.get();
  if (!doc.exists) return NextResponse.json({ error: "goods not found" }, { status: 404 });

  // 承認時点でも掲載資格(プレミアム・在籍)を再確認する
  if (status === "approved") {
    const streamerDoc = await db.collection("streamers").doc(params.id).get();
    const streamer = streamerDoc.data();
    const eligible = streamer &&
      streamer.plan_type === "boost" &&
      streamer.is_deleted !== true &&
      streamer.withdrawal_status !== "requested";
    if (!eligible) {
      return NextResponse.json({
        error: "この配信者は現在プレミアムプランではないため承認できません。",
        code: "PLAN_REQUIRED",
      }, { status: 409 });
    }
  }

  await ref.set(stripUndefined({
    status,
    admin_note: adminNote,
    reviewed_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  }), { merge: true });

  await db.collection("admin_audit_logs").add(stripUndefined({
    admin_session_id: getCookieValue(request.headers.get("cookie"), adminCookieName) || request.headers.get("x-admin-key") || "unknown",
    action: `vtuber_goods_${status}`,
    target_type: "vtuber_goods",
    target_id: params.id,
    before: { status: String(doc.data()?.status || "") },
    after: { status },
    created_at: FieldValue.serverTimestamp(),
  }));

  invalidateGoodsCache();

  return NextResponse.json({ ok: true, status });
}
