import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { addLocalViewerActivity, findLocalStreamer } from "@/lib/localStore";

export async function POST(request: Request) {
  const body = await request.json();
  const streamerId = clean(body.streamer_id, 120);
  const viewerProfileId = clean(body.viewer_profile_id, 120);
  const userId = clean(body.user_id, 120);
  const action = body.action === "like" ? "like" : "view";
  const viewerProfile = normalizeViewerProfile(body.viewer_profile, viewerProfileId || userId);

  if (!streamerId || !viewerProfileId) {
    return NextResponse.json({ error: "streamer_id and viewer_profile_id are required" }, { status: 400 });
  }

  const db = getAdminDb();
  if (!db) {
    const streamer = await findLocalStreamer(streamerId);
    if (!streamer) return NextResponse.json({ error: "streamer not found" }, { status: 404 });
    await addLocalViewerActivity({
      streamer_id: streamerId,
      viewer_profile_id: viewerProfileId,
      user_id: userId,
      action,
      viewer_profile: viewerProfile,
    });
    return NextResponse.json({ ok: true, source: "local" });
  }

  const streamerDoc = await db.collection("streamers").doc(streamerId).get();
  if (!streamerDoc.exists) return NextResponse.json({ error: "streamer not found" }, { status: 404 });

  await db.collection("viewer_activities").doc(`${streamerId}_${viewerProfileId}_${action}`).set({
    streamer_id: streamerId,
    viewer_profile_id: viewerProfileId,
    user_id: userId,
    action,
    viewer_profile: viewerProfile,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });

  return NextResponse.json({ ok: true, source: "firestore" });
}

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function normalizeViewerProfile(value: unknown, fallbackId: string) {
  if (!value || typeof value !== "object") {
    return {
      id: fallbackId,
      is_anonymous: fallbackId.startsWith("anon-viewer-"),
      visible_to_matched_streamers: true,
    };
  }
  const input = value as Record<string, unknown>;
  return {
    id: typeof input.id === "string" ? input.id : fallbackId,
    is_anonymous: Boolean(input.is_anonymous) || String(input.id || fallbackId).startsWith("anon-viewer-"),
    display_name: typeof input.display_name === "string" ? input.display_name : "",
    image: typeof input.image === "string" ? input.image : "",
    viewer_plan: "free",
    visible_to_matched_streamers: input.visible_to_matched_streamers !== false,
  };
}
