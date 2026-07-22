import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { applyAdminOrderAction, type AdminOrderAction } from "@/lib/tshirt/orders";

export const dynamic = "force-dynamic";

const ALLOWED_ACTIONS: AdminOrderAction[] = [
  "cutting",
  "cut_complete",
  "packed",
  "shipped",
  "cancelled",
  "regenerate",
  "mark_refunded",
];

// 管理: 出荷運用アクション（状態遷移・追跡番号・キャンセル・返金印・SVG再生成）。
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "database unavailable" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "") as AdminOrderAction;
  if (!ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const result = await applyAdminOrderAction(db, params.id, action, {
    trackingNumber: typeof body.trackingNumber === "string" ? body.trackingNumber.trim().slice(0, 100) : undefined,
    shippingMethod: typeof body.shippingMethod === "string" ? body.shippingMethod.trim().slice(0, 100) : undefined,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "操作に失敗しました。" }, { status: result.status || 400 });
  }
  return NextResponse.json({ ok: true });
}

// 管理: Tシャツ注文の詳細（生成物のSVG/プレビューは別ルートで配信）。
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "database unavailable" }, { status: 503 });

  const doc = await db.collection("orders").doc(params.id).get();
  if (!doc.exists || String(doc.data()?.order_type || "") !== "tshirt_kit") {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }
  const d = doc.data() || {};
  return NextResponse.json({ id: doc.id, ...d, createdAt: undefined, ...serializeTimestamps(d) });
}

function serializeTimestamps(d: Record<string, unknown>) {
  const out: Record<string, string> = {};
  for (const key of ["createdAt", "paidAt", "shippedAt", "updatedAt"]) {
    const value = d[key];
    if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
      out[key] = (value as { toDate: () => Date }).toDate().toISOString();
    }
  }
  return out;
}
