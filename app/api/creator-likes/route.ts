import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { creatorSessionCookie, readUserSession } from "@/lib/userSession";
import { likeViewerBack } from "@/lib/streamerLikes";
import { notifyViewerLikedByStreamer } from "@/lib/notifications";

export async function POST(request: Request) {
  const session = readUserSession<{ streamer_id?: string }>(request, creatorSessionCookie);
  if (!session?.streamer_id) return NextResponse.json({ error: "creator login required" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const viewerProfileId = String(body.viewer_profile_id || "");
  if (!viewerProfileId) return NextResponse.json({ error: "viewer_profile_id is required" }, { status: 400 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "Firestore is not configured" }, { status: 501 });

  const viewerDoc = await db.collection("viewer_profiles").doc(viewerProfileId).get();
  if (!viewerDoc.exists) return NextResponse.json({ error: "viewer not found" }, { status: 404 });

  const result = await likeViewerBack(session.streamer_id, viewerProfileId);
  if (result.created) {
    const fcmTokens = viewerDoc.data()?.fcm_tokens;
    await notifyViewerLikedByStreamer(viewerProfileId, Array.isArray(fcmTokens) ? fcmTokens : undefined)
      .catch((error) => console.error("notifyViewerLikedByStreamer failed:", error));
  }

  return NextResponse.json({ ok: true, already_liked: !result.created });
}
