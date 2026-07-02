import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { adminCookieName, getCookieValue } from "@/lib/adminSession";
import { FieldValue, getAdminDb, stripUndefined } from "@/lib/firebaseAdmin";
import { findLocalStreamer, updateLocalStreamer } from "@/lib/localStore";

type EngagementAction = "like" | "impression";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const action = body.action === "impression" ? "impression" : body.action === "like" ? "like" : "";
  if (!action) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const db = getAdminDb();
  if (!db) {
    const streamer = await applyLocalEngagement(params.id, action);
    if (!streamer) return NextResponse.json({ error: "streamer not found" }, { status: 404 });
    return NextResponse.json({
      ok: true,
      source: "local",
      likes: Number(streamer.likes || 0),
      impressions: Number(streamer.impressions || 0),
    });
  }

  const ref = db.collection("streamers").doc(params.id);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data()?.is_deleted === true) {
    return NextResponse.json({ error: "streamer not found" }, { status: 404 });
  }

  const before = snapshot.data() || {};
  const weekKey = currentJstWeekKey();
  const patch = action === "like"
    ? { likes: FieldValue.increment(1) }
    : {
        impressions: FieldValue.increment(1),
        [`weekly_impressions.${weekKey}`]: FieldValue.increment(1),
      };

  const auditRef = db.collection("admin_audit_logs").doc();
  const batch = db.batch();
  batch.update(ref, patch);

  if (action === "like") {
    const now = Date.now();
    const likeRef = db.collection("likes").doc(`admin_manual_${params.id}_${now}`);
    const activityRef = db.collection("viewer_activities").doc(`${params.id}_admin_manual_like_${now}`);
    const notificationRef = db.collection("notifications").doc();
    const anonymousProfile = {
      id: `admin-manual-${now}`,
      is_anonymous: true,
      visible_to_matched_streamers: true,
      viewer_plan: "free",
    };
    batch.set(likeRef, stripUndefined({
      user_id: "admin_manual",
      streamer_id: params.id,
      viewer_profile_id: anonymousProfile.id,
      viewer_profile: anonymousProfile,
      source: "admin_manual",
      created_at: FieldValue.serverTimestamp(),
    }));
    batch.set(activityRef, stripUndefined({
      streamer_id: params.id,
      viewer_id: anonymousProfile.id,
      action: "like",
      source: "admin_manual",
      viewer_profile: anonymousProfile,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    }));
    batch.set(notificationRef, stripUndefined({
      target_type: "creator",
      streamer_id: params.id,
      type: "like",
      title: "匿名の視聴者からいいねが届きました",
      body: "あなたのプロフィールにいいねが届きました。",
      read: false,
      source: "admin_manual",
      created_at: FieldValue.serverTimestamp(),
    }));
  }

  batch.set(auditRef, stripUndefined({
    admin_session_id: getCookieValue(request.headers.get("cookie"), adminCookieName) || request.headers.get("x-admin-key") || "unknown",
    action: action === "like" ? "admin_manual_like" : "admin_manual_impression",
    target_type: "streamer",
    target_id: params.id,
    before: {
      likes: Number(before.likes || 0),
      impressions: Number(before.impressions || 0),
    },
    after: action === "like"
      ? { likes: Number(before.likes || 0) + 1 }
      : { impressions: Number(before.impressions || 0) + 1 },
    created_at: FieldValue.serverTimestamp(),
  }));

  await batch.commit();

  return NextResponse.json({
    ok: true,
    source: "firestore",
    likes: Number(before.likes || 0) + (action === "like" ? 1 : 0),
    impressions: Number(before.impressions || 0) + (action === "impression" ? 1 : 0),
  });
}

async function applyLocalEngagement(id: string, action: EngagementAction) {
  const streamer = await findLocalStreamer(id).catch(() => null);
  if (!streamer || streamer.is_deleted === true) return null;
  const patch = action === "like"
    ? { likes: Number(streamer.likes || 0) + 1 }
    : { impressions: Number(streamer.impressions || 0) + 1 };
  return updateLocalStreamer(id, patch);
}

function currentJstWeekKey() {
  const jstDate = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const base = new Date(`${jstDate}T00:00:00+09:00`);
  const day = base.getUTCDay() || 7;
  base.setUTCDate(base.getUTCDate() - day + 1);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base);
}
