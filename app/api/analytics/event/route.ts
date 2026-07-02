import { NextResponse } from "next/server";
import { analyticsFieldForEvent, type AnalyticsEventType } from "@/lib/analytics";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { recordLocalAnalyticsEvent } from "@/lib/localStore";

const allowedEvents = new Set<AnalyticsEventType>(["swiped_visitor", "swipe_action", "viewer_register_click", "creator_register_click"]);

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
    await Promise.all([
      dailyDoc.set({
        date,
        [field]: FieldValue.increment(increment),
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true }),
      totalsDoc.set({
        [field]: FieldValue.increment(increment),
        updated_at: FieldValue.serverTimestamp(),
      }, { merge: true })
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("analytics event skipped:", error instanceof Error ? error.message : String(error || "unknown"));
    return NextResponse.json({ ok: true, skipped: true });
  }
}

function cleanId(value: unknown) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 120);
}
