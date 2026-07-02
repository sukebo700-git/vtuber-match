import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { adminCookieName, getCookieValue } from "@/lib/adminSession";
import { FieldValue, getAdminDb, stripUndefined } from "@/lib/firebaseAdmin";
import { readLocalStreamers, updateLocalStreamer } from "@/lib/localStore";

const chunkSize = 100;

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getAdminDb();
  if (!db) {
    const streamers = await readLocalStreamers();
    const targets = streamers.filter(isTargetStreamer);
    for (const streamer of targets) {
      await updateLocalStreamer(streamer.id, {
        likes: Number(streamer.likes || 0) + 1,
        impressions: Number(streamer.impressions || 0) + 1,
      });
    }
    return NextResponse.json({ ok: true, source: "local", count: targets.length });
  }

  const snapshot = await db.collection("streamers")
    .select("is_visible", "is_deleted", "is_dummy", "dummy", "test", "fictional", "isHidden", "likes", "impressions")
    .limit(500)
    .get();
  const targets = snapshot.docs.filter((doc) => isTargetStreamer({ id: doc.id, ...(doc.data() || {}) }));
  const weekKey = currentJstWeekKey();
  const adminSessionId = getCookieValue(request.headers.get("cookie"), adminCookieName) || request.headers.get("x-admin-key") || "unknown";
  const now = Date.now();

  for (let index = 0; index < targets.length; index += chunkSize) {
    const batch = db.batch();
    const chunk = targets.slice(index, index + chunkSize);
    chunk.forEach((doc, chunkIndex) => {
      const data = doc.data() || {};
      const serial = `${now}_${index + chunkIndex}`;
      const streamerRef = db.collection("streamers").doc(doc.id);
      const anonymousProfile = {
        id: `admin-bulk-${serial}`,
        is_anonymous: true,
        visible_to_matched_streamers: true,
        viewer_plan: "free",
      };

      batch.update(streamerRef, {
        likes: FieldValue.increment(1),
        impressions: FieldValue.increment(1),
        [`weekly_impressions.${weekKey}`]: FieldValue.increment(1),
      });
      batch.set(db.collection("likes").doc(`admin_bulk_${doc.id}_${serial}`), stripUndefined({
        user_id: "admin_bulk",
        streamer_id: doc.id,
        viewer_profile_id: anonymousProfile.id,
        viewer_profile: anonymousProfile,
        source: "admin_bulk",
        created_at: FieldValue.serverTimestamp(),
      }));
      batch.set(db.collection("viewer_activities").doc(`${doc.id}_admin_bulk_like_${serial}`), stripUndefined({
        streamer_id: doc.id,
        viewer_id: anonymousProfile.id,
        action: "like",
        source: "admin_bulk",
        viewer_profile: anonymousProfile,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      }));
      batch.set(db.collection("notifications").doc(), stripUndefined({
        target_type: "creator",
        streamer_id: doc.id,
        type: "like",
        title: "匿名の視聴者からいいねが届きました",
        body: "あなたのプロフィールにいいねが届きました。",
        read: false,
        source: "admin_bulk",
        created_at: FieldValue.serverTimestamp(),
      }));
      batch.set(db.collection("admin_audit_logs").doc(), stripUndefined({
        admin_session_id: adminSessionId,
        action: "admin_bulk_like_and_impression",
        target_type: "streamer",
        target_id: doc.id,
        before: {
          likes: Number(data.likes || 0),
          impressions: Number(data.impressions || 0),
        },
        after: {
          likes: Number(data.likes || 0) + 1,
          impressions: Number(data.impressions || 0) + 1,
        },
        created_at: FieldValue.serverTimestamp(),
      }));
    });
    await batch.commit();
  }

  return NextResponse.json({ ok: true, source: "firestore", count: targets.length });
}

function isTargetStreamer(streamer: Record<string, unknown>) {
  return streamer.is_visible !== false &&
    streamer.is_deleted !== true &&
    streamer.is_dummy !== true &&
    streamer.dummy !== true &&
    streamer.test !== true &&
    streamer.fictional !== true &&
    streamer.isHidden !== true;
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
