import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { adminCookieName, getCookieValue } from "@/lib/adminSession";
import { FieldValue, getAdminDb, stripUndefined } from "@/lib/firebaseAdmin";
import { readLocalStreamers, updateLocalStreamer } from "@/lib/localStore";

const chunkSize = 100;

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // ボディなしの呼び出し(=全員対象)も許可する
  }
  const streamerIds = Array.isArray(body.streamer_ids)
    ? body.streamer_ids.map(String).filter(Boolean)
    : null;
  // "both": いいね+表示回数を両方+1(既定・従来動作) / "impressions": 表示回数のみ+1
  const metric = body.metric === "impressions" ? "impressions" : "both";

  const db = getAdminDb();
  if (!db) {
    const streamers = await readLocalStreamers();
    let targets = streamers.filter(isTargetStreamer);
    if (streamerIds) targets = targets.filter((streamer) => streamerIds.includes(streamer.id));
    for (const streamer of targets) {
      const patch: Record<string, number> = { impressions: Number(streamer.impressions || 0) + 1 };
      if (metric === "both") patch.likes = Number(streamer.likes || 0) + 1;
      await updateLocalStreamer(streamer.id, patch);
    }
    return NextResponse.json({ ok: true, source: "local", count: targets.length });
  }

  const snapshot = await db.collection("streamers")
    .select("is_visible", "is_deleted", "is_dummy", "dummy", "test", "fictional", "isHidden", "likes", "impressions")
    .limit(500)
    .get();
  let targets = snapshot.docs.filter((doc) => isTargetStreamer({ id: doc.id, ...(doc.data() || {}) }));
  if (streamerIds) targets = targets.filter((doc) => streamerIds.includes(doc.id));
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

      const updatePatch: Record<string, unknown> = {
        impressions: FieldValue.increment(1),
        [`weekly_impressions.${weekKey}`]: FieldValue.increment(1),
      };
      if (metric === "both") updatePatch.likes = FieldValue.increment(1);
      batch.update(streamerRef, updatePatch);

      if (metric === "both") {
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
      }
      batch.set(db.collection("admin_audit_logs").doc(), stripUndefined({
        admin_session_id: adminSessionId,
        action: metric === "both" ? "admin_bulk_like_and_impression" : "admin_bulk_impression_only",
        target_type: "streamer",
        target_id: doc.id,
        before: {
          likes: Number(data.likes || 0),
          impressions: Number(data.impressions || 0),
        },
        after: {
          likes: Number(data.likes || 0) + (metric === "both" ? 1 : 0),
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
