import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
  const body = await request.json();
  const userId = String(body.user_id || "");
  const token = String(body.fcm_token || "");
  const targetType = body.target_type === "viewer" ? "viewer" : "creator";
  const streamerId = String(body.streamer_id || "");
  const applicationId = String(body.application_id || "");
  const viewerProfileId = String(body.viewer_profile_id || "");

  if (!userId || !token) return NextResponse.json({ error: "user_id and fcm_token are required" }, { status: 400 });
  if (targetType === "creator" && !streamerId && !applicationId) return NextResponse.json({ error: "streamer_id or application_id is required" }, { status: 400 });
  if (targetType === "viewer" && !viewerProfileId) return NextResponse.json({ error: "viewer_profile_id is required" }, { status: 400 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ ok: true, source: "local" });

  await db.collection("users").doc(userId).set({
    fcm_token: token,
    type: targetType,
    streamer_id: streamerId || null,
    application_id: applicationId || null,
    viewer_profile_id: viewerProfileId || null,
    updated_at: FieldValue.serverTimestamp()
  }, { merge: true });

  if (streamerId) {
    await db.collection("streamers").doc(streamerId).set({
      fcm_tokens: FieldValue.arrayUnion(token)
    }, { merge: true });
  }

  if (applicationId) {
    await db.collection("applications").doc(applicationId).set({
      fcm_tokens: FieldValue.arrayUnion(token),
      updated_at: FieldValue.serverTimestamp()
    }, { merge: true });
  }

  if (viewerProfileId) {
    await db.collection("viewer_profiles").doc(viewerProfileId).set({
      fcm_tokens: FieldValue.arrayUnion(token),
      updated_at: FieldValue.serverTimestamp()
    }, { merge: true });
  }

  return NextResponse.json({ ok: true, source: "firestore" });
}
