import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { incrementLocalStreamer } from "@/lib/localStore";

export async function POST(request: Request) {
  const body = await request.json();
  const streamerId = String(body.streamer_id || "");
  if (!streamerId) return NextResponse.json({ error: "streamer_id is required" }, { status: 400 });

  const db = getAdminDb();
  if (!db) {
    await incrementLocalStreamer(streamerId, "impressions");
    return NextResponse.json({ ok: true, source: "local" });
  }

  await db.collection("streamers").doc(streamerId).update({
    impressions: FieldValue.increment(1)
  });

  return NextResponse.json({ ok: true, source: "firestore" });
}
