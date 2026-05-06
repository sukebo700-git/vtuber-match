import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
  const body = await request.json();
  const userId = String(body.user_id || "");
  const token = String(body.fcm_token || "");
  const streamerId = String(body.streamer_id || "");

  if (!userId || !token) return NextResponse.json({ error: "user_id and fcm_token are required" }, { status: 400 });

  const db = getAdminDb();
  if (!db) return NextResponse.json({ ok: true, source: "local" });

  await db.collection("users").doc(userId).set({
    fcm_token: token,
    type: streamerId ? "streamer" : "viewer",
    streamer_id: streamerId || null,
    updated_at: FieldValue.serverTimestamp()
  }, { merge: true });

  if (streamerId) {
    await db.collection("streamers").doc(streamerId).set({
      fcm_tokens: FieldValue.arrayUnion(token)
    }, { merge: true });
  }

  return NextResponse.json({ ok: true, source: "firestore" });
}
