import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { addLocalCreatorLike } from "@/lib/localStore";

export async function POST(request: Request) {
  const body = await request.json();
  const streamerId = String(body.streamer_id || "");
  const viewerProfileId = String(body.viewer_profile_id || "");
  if (!streamerId || !viewerProfileId) {
    return NextResponse.json({ error: "streamer_id and viewer_profile_id are required" }, { status: 400 });
  }

  const db = getAdminDb();
  if (!db) {
    const created = await addLocalCreatorLike(streamerId, viewerProfileId);
    return NextResponse.json({ liked: true, created, source: "local" });
  }

  const likeRef = db.collection("creator_likes").doc(`${streamerId}_${viewerProfileId}`);
  await db.runTransaction(async (tx) => {
    const likeDoc = await tx.get(likeRef);
    if (likeDoc.exists) return;
    tx.set(likeRef, {
      streamer_id: streamerId,
      viewer_profile_id: viewerProfileId,
      timestamp: FieldValue.serverTimestamp()
    });
    tx.set(db.collection("viewer_profiles").doc(viewerProfileId), {
      streamer_like_count: FieldValue.increment(1),
      updated_at: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  return NextResponse.json({ liked: true, source: "firestore" });
}
