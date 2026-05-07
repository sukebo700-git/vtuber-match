import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { addLocalLike, incrementLocalStreamer } from "@/lib/localStore";
import { notifyStreamerLike } from "@/lib/notifications";

export async function POST(request: Request) {
  const body = await request.json();
  const userId = String(body.user_id || "");
  const streamerId = String(body.streamer_id || "");
  const viewerProfileId = String(body.viewer_profile_id || "");
  const viewerProfile = normalizeViewerProfile(body.viewer_profile, viewerProfileId);
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
      viewer_profile_id: viewerProfile?.id || viewerProfileId || null,
      viewer_profile: viewerProfile || null,
      timestamp: FieldValue.serverTimestamp()
    });
    tx.update(streamerRef, { likes: FieldValue.increment(1) });
    tx.set(db.collection("notifications").doc(), {
      target_type: "streamer",
      streamer_id: streamerId,
      viewer_profile_id: viewerProfile?.id || viewerProfileId || null,
      type: "LIKE_CREATED",
      title: "新しいいいね",
      body: "視聴者からいいねが届きました",
      read: false,
      created_at: FieldValue.serverTimestamp()
    });
  });

  const streamer = streamerDoc.data() || {};
  await notifyStreamerLike(streamer.fcm_tokens, streamer.name || "配信者");

  return NextResponse.json({
    matched: true,
    youtube_url: streamer.youtube_url,
    source: "firestore"
  });
}

function normalizeViewerProfile(value: unknown, fallbackId = "") {
  if (!value || typeof value !== "object") {
    return fallbackId ? { id: fallbackId } : null;
  }
  const input = value as Record<string, unknown>;
  if (input.visible_to_matched_streamers === false) return null;
  const isPaid = input.viewer_plan === "viewer_paid" || input.subscription_status === "active";
  return {
    id: typeof input.id === "string" ? input.id : fallbackId,
    display_name: typeof input.display_name === "string" ? input.display_name : "",
    viewer_plan: isPaid ? "viewer_paid" : "free",
    youtube_display_name: isPaid && typeof input.youtube_display_name === "string" ? input.youtube_display_name : "",
    twitter_id: isPaid && typeof input.twitter_id === "string" ? input.twitter_id : "",
    one_liner: isPaid && typeof input.one_liner === "string" ? input.one_liner : "",
    image: typeof input.image === "string" ? input.image : "",
    profile: isPaid && typeof input.profile === "string" ? input.profile : "",
    favorite_categories: Array.isArray(input.favorite_categories) ? input.favorite_categories.filter((item) => typeof item === "string").slice(0, 5) : []
  };
}
