import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { addLocalLike, incrementLocalStreamer } from "@/lib/localStore";
import { notifyStreamerLike } from "@/lib/notifications";

export async function POST(request: Request) {
  const body = await request.json();
  const userId = String(body.user_id || "");
  const streamerId = String(body.streamer_id || "");
  const viewerProfile = normalizeViewerProfile(body.viewer_profile);
  if (!userId || !streamerId) return NextResponse.json({ error: "user_id and streamer_id are required" }, { status: 400 });

  const db = getAdminDb();
  if (!db) {
    await addLocalLike(userId, streamerId, viewerProfile || undefined);
    await incrementLocalStreamer(streamerId, "likes");
    return NextResponse.json({ matched: true, source: "local" });
  }

  const streamerRef = db.collection("streamers").doc(streamerId);
  const streamerDoc = await streamerRef.get();
  if (!streamerDoc.exists) return NextResponse.json({ error: "streamer not found" }, { status: 404 });

  await db.runTransaction(async (tx) => {
    const likeRef = db.collection("likes").doc(`${userId}_${streamerId}_${Date.now()}`);
    tx.set(likeRef, {
      user_id: userId,
      streamer_id: streamerId,
      viewer_profile: viewerProfile || null,
      timestamp: FieldValue.serverTimestamp()
    });
    tx.update(streamerRef, { likes: FieldValue.increment(1) });
  });

  const streamer = streamerDoc.data() || {};
  await notifyStreamerLike(streamer.fcm_tokens, streamer.name || "配信者");

  return NextResponse.json({
    matched: true,
    youtube_url: streamer.youtube_url,
    source: "firestore"
  });
}

function normalizeViewerProfile(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (input.visible_to_matched_streamers === false) return null;
  return {
    id: typeof input.id === "string" ? input.id : "",
    display_name: typeof input.display_name === "string" ? input.display_name : "",
    youtube_display_name: typeof input.youtube_display_name === "string" ? input.youtube_display_name : "",
    image: typeof input.image === "string" ? input.image : "",
    profile: typeof input.profile === "string" ? input.profile : "",
    favorite_categories: Array.isArray(input.favorite_categories) ? input.favorite_categories.filter((item) => typeof item === "string").slice(0, 5) : []
  };
}
