import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";

admin.initializeApp();

export const syncLatestYouTubeVideos = onSchedule("every 24 hours", async () => {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    logger.warn("YOUTUBE_API_KEY is not set");
    return;
  }

  const db = admin.firestore();
  const snapshot = await db.collection("streamers").where("youtube_channel_id", "!=", null).limit(40).get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const latest = await fetchLatest(data.youtube_channel_id, key);
    if (!latest) continue;

    await doc.ref.update({
      latest_video_id: latest.videoId,
      last_video_date: latest.publishedAt,
      last_youtube_checked_at: admin.firestore.FieldValue.serverTimestamp()
    });
  }
});

async function fetchLatest(channelId: string, key: string) {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("channelId", channelId);
  url.searchParams.set("order", "date");
  url.searchParams.set("maxResults", "1");
  url.searchParams.set("type", "video");
  url.searchParams.set("key", key);

  const response = await fetch(url);
  if (!response.ok) {
    logger.warn("YouTube API failed", { channelId, status: response.status });
    return null;
  }

  const json = await response.json() as {
    items?: Array<{ id?: { videoId?: string }; snippet?: { publishedAt?: string } }>;
  };
  const item = json.items?.[0];
  if (!item?.id?.videoId || !item.snippet?.publishedAt) return null;

  return {
    videoId: item.id.videoId,
    publishedAt: item.snippet.publishedAt
  };
}
