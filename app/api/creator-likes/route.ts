import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { addLocalCreatorLike } from "@/lib/localStore";
import { notifyViewerCreatorLike } from "@/lib/notifications";
import { creatorSessionCookie, readUserSession } from "@/lib/userSession";

export async function POST(request: Request) {
  const body = await request.json();
  const streamerId = String(body.streamer_id || "");
  const viewerProfileId = String(body.viewer_profile_id || "");
  if (!streamerId || !viewerProfileId) {
    return NextResponse.json({ error: "streamer_id and viewer_profile_id are required" }, { status: 400 });
  }
  const session = readUserSession<{ streamer_id?: string }>(request, creatorSessionCookie);
  if (!session?.streamer_id || session.streamer_id !== streamerId) {
    return NextResponse.json({ error: "creator login required" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    const created = await addLocalCreatorLike(streamerId, viewerProfileId);
    return NextResponse.json({ liked: true, created, source: "local" });
  }

  const streamerDoc = await db.collection("streamers").doc(streamerId).get();
  if (streamerDoc.data()?.plan_type !== "boost") {
    return NextResponse.json({ error: "premium plan is required" }, { status: 403 });
  }
  const matchSnapshot = await db.collection("likes")
    .where("streamer_id", "==", streamerId)
    .where("viewer_profile_id", "==", viewerProfileId)
    .limit(1)
    .get();
  if (matchSnapshot.empty) {
    return NextResponse.json({ error: "matched viewer is required" }, { status: 403 });
  }

  const viewerDoc = await db.collection("viewer_profiles").doc(viewerProfileId).get();
  const likeRef = db.collection("creator_likes").doc(`${streamerId}_${viewerProfileId}`);
  let created = false;
  await db.runTransaction(async (tx) => {
    const likeDoc = await tx.get(likeRef);
    if (likeDoc.exists) return;
    created = true;
    tx.set(likeRef, {
      streamer_id: streamerId,
      viewer_profile_id: viewerProfileId,
      timestamp: FieldValue.serverTimestamp()
    });
    tx.set(db.collection("viewer_profiles").doc(viewerProfileId), {
      streamer_like_count: FieldValue.increment(1),
      updated_at: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.set(db.collection("notifications").doc(), {
      target_type: "viewer",
      viewer_profile_id: viewerProfileId,
      streamer_id: streamerId,
      type: "CREATOR_LIKE_CREATED",
      title: "配信者からいいね",
      body: "マッチした配信者からいいねが届きました",
      read: false,
      created_at: FieldValue.serverTimestamp()
    });
  });

  const viewer = viewerDoc.data() || {};
  if (created) await notifyViewerCreatorLike(viewer.fcm_tokens);

  return NextResponse.json({ liked: true, created, source: "firestore" });
}
