import { NextResponse } from "next/server";
import { analyticsFieldForEvent, type AnalyticsEventType } from "@/lib/analytics";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { recordLocalAnalyticsEvent } from "@/lib/localStore";

const allowedEvents = new Set<AnalyticsEventType>(["swiped_visitor", "swipe_action", "viewer_register_click", "creator_register_click", "apply_image_rejected"]);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const eventType = String(body.event_type || "") as AnalyticsEventType;
    if (!allowedEvents.has(eventType)) {
      return NextResponse.json({ error: "unknown event" }, { status: 400 });
    }

    const visitorId = cleanId(body.visitor_id) || "anonymous";
    const count = Math.max(1, Math.min(100, Math.floor(Number(body.count || 1))));
    const date = new Date().toISOString().slice(0, 10);
    const db = getAdminDb();

    if (!db) {
      await recordLocalAnalyticsEvent(eventType, visitorId).catch(() => undefined);
      return NextResponse.json({ ok: true });
    }

    const field = analyticsFieldForEvent(eventType);
    const increment = eventType === "swipe_action" ? count : 1;
    const dailyDoc = db.collection("analytics_daily").doc(date);
    const totalsDoc = db.collection("aggregates").doc("analytics_totals");
    const payload: Record<string, unknown> = {
      [field]: FieldValue.increment(increment),
      updated_at: FieldValue.serverTimestamp(),
    };
    // 画像が弾かれた場合は短辺のバケットも併記する。回数だけでは
    // 「制限を何pxまで緩めれば通るのか」が判断できないため。
    const sizeBucket = eventType === "apply_image_rejected" ? imageSizeBucket(body.image_min_side) : "";
    if (sizeBucket) payload[`${field}_${sizeBucket}`] = FieldValue.increment(1);
    await Promise.all([
      dailyDoc.set({ date, ...payload }, { merge: true }),
      totalsDoc.set(payload, { merge: true })
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("analytics event skipped:", error instanceof Error ? error.message : String(error || "unknown"));
    return NextResponse.json({ ok: true, skipped: true });
  }
}

// 任意の数値がFirestoreのフィールド名になることを防ぐため、
// 固定のバケット名のみを返す。
function imageSizeBucket(value: unknown) {
  const side = Math.floor(Number(value));
  if (!Number.isFinite(side) || side <= 0) return "unknown";
  if (side < 100) return "lt100";
  if (side < 200) return "lt200";
  if (side < 300) return "lt300";
  if (side < 400) return "lt400";
  return "lt500";
}

function cleanId(value: unknown) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 120);
}
