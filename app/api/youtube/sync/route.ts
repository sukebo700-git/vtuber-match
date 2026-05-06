import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/firebaseAdmin";
import { fetchLatestYouTubeVideo } from "@/lib/youtube";

export async function POST() {
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "Firebase admin env is required for YouTube sync" }, { status: 501 });

  const snapshot = await db.collection("streamers").where("youtube_channel_id", "!=", null).limit(40).get();
  const results = [];

  for (const doc of snapshot.docs) {
    const streamer = doc.data();
    const latest = await fetchLatestYouTubeVideo(streamer.youtube_channel_id);
    if (!latest) continue;

    await doc.ref.update({
      latest_video_id: latest.videoId,
      last_video_date: latest.publishedAt,
      last_youtube_checked_at: FieldValue.serverTimestamp()
    });
    results.push({ id: doc.id, latest_video_id: latest.videoId });
  }

  return NextResponse.json({ updated: results.length, results });
}
